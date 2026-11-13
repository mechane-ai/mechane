locals {
  installation = jsondecode(file("${path.module}/installation.json"))
  origin       = "https://${var.domain.hostname}"

  variables = merge(local.installation.defaults, var.settings, {
    MECHANE_ORIGIN                   = local.origin
    MECHANE_RUNTIME_ORIGIN           = local.origin
    MECHANE_SANDBOX_ORIGIN           = local.origin
    MECHANE_INSTALLATION_HOSTS       = jsonencode(setunion(var.domain.aliases, [var.domain.hostname]))
    MECHANE_WORKER_REVISION          = local.installation.public_commit
    MECHANE_SANDBOX_PROVIDER         = "container"
    MECHANE_CONTAINER_IMAGE          = mechane_cloudflare_container_image.guest.image
    MECHANE_CONTAINER_INSTANCE_TYPE  = var.sandboxes.instance_type
    MECHANE_MAX_MACHINES             = tostring(var.sandboxes.max_instances)
    MECHANE_SANDBOX_HOSTS            = jsonencode(var.sandboxes.additional_hosts)
    MECHANE_SANDBOX_TOOLS            = jsonencode(var.sandboxes.additional_tools)
    MECHANE_SANDBOX_WEB_ACCESS       = var.sandboxes.web_access
    MECHANE_BROWSER_SANDBOX_DISABLED = tostring(var.sandboxes.browser_sandbox_disabled)
  })
}

resource "cloudflare_r2_bucket" "workspace_files" {
  account_id    = var.account_id
  name          = coalesce(var.storage.workspace_bucket_name, "${var.name}-workspace-files")
  jurisdiction  = var.storage.jurisdiction
  location      = var.storage.location
  storage_class = "Standard"

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_worker" "service" {
  account_id = var.account_id
  name       = var.name
  subdomain = {
    enabled          = false
    previews_enabled = false
  }
  observability = {
    enabled            = true
    head_sampling_rate = 1
    logs = {
      enabled            = true
      invocation_logs    = false
      persist            = true
      head_sampling_rate = 1
    }
    traces = { enabled = false }
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "mechane_cloudflare_worker_release" "release" {
  account_id              = var.account_id
  worker_name             = cloudflare_worker.service.name
  release_manifest_file   = "${path.module}/installation.json"
  release_manifest_sha256 = filesha256("${path.module}/installation.json")
  qualification_file      = var.qualification.path
  qualification_sha256    = var.qualification.sha256
  bindings = concat(
    [{
      name         = "WORKSPACE_FILES"
      type         = "r2_bucket"
      bucket_name  = cloudflare_r2_bucket.workspace_files.name
      jurisdiction = var.storage.jurisdiction == "default" ? null : var.storage.jurisdiction
    }],
    [for name, value in local.variables : { name = name, type = "plain_text", text = value }],
    [for name, secret_name in var.secrets.bindings : {
      name        = name
      type        = "secrets_store_secret"
      store_id    = var.secrets.store_id
      secret_name = secret_name
    }],
  )

  lifecycle {
    precondition {
      condition     = filesha256("${path.module}/${local.installation.worker.path}") == local.installation.worker.sha256
      error_message = "The Worker bundle does not match this release's installation manifest."
    }
    precondition {
      condition     = local.installation.format_version == 2
      error_message = "This module cannot read the installation manifest version."
    }
    precondition {
      condition     = length(setintersection(toset(keys(local.variables)), toset(keys(var.secrets.bindings)))) == 0
      error_message = "A binding cannot be both a non-secret setting and a secret reference."
    }
    precondition {
      condition     = !local.installation.is_preview
      error_message = "A local validation preview cannot be deployed. Use a published release archive."
    }
  }
}

resource "mechane_cloudflare_container_image" "guest" {
  account_id    = var.account_id
  repository    = "${var.name}-guest"
  source_file   = "${dirname(var.qualification.path)}/${basename(local.installation.guest.url)}"
  source_sha256 = local.installation.guest.sha256
  digest        = local.installation.guest.digest
  depends_on    = [cloudflare_worker.service]
}

resource "cloudflare_workers_cron_trigger" "control_delivery" {
  account_id  = var.account_id
  script_name = cloudflare_worker.service.name
  schedules   = [for cron in local.installation.worker.triggers.crons : { cron = cron }]
  depends_on  = [mechane_cloudflare_worker_release.release]
}

resource "mechane_cloudflare_machine_application" "machines" {
  account_id                  = var.account_id
  name                        = coalesce(var.sandboxes.application_name, "${var.name}-machines")
  durable_object_namespace_id = mechane_cloudflare_worker_release.release.durable_object_namespaces["MachineObject"]
  delete_protection           = true
  logs_enabled                = true
}

resource "cloudflare_workers_custom_domain" "service" {
  for_each   = setunion(var.domain.aliases, [var.domain.hostname])
  account_id = var.account_id
  hostname   = each.value
  zone_id    = var.domain.zone_id
  service    = cloudflare_worker.service.name
  depends_on = [mechane_cloudflare_machine_application.machines]
}
