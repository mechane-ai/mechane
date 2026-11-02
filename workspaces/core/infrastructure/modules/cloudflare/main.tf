locals {
  installation = jsondecode(file("${path.module}/installation.json"))
  origin       = "https://${var.domain.hostname}"

  variables = merge(local.installation.defaults, {
    MECHANE_ORIGIN                   = local.origin
    MECHANE_WORKER_REVISION          = local.installation.public_commit
    MECHANE_RELEASE_ORIGIN           = "https://github.com/${local.installation.repository}/releases/download"
    MECHANE_GITHUB_CLIENT_ID         = var.authentication.github_client_id
    MECHANE_ADMINISTRATOR_IDENTITIES = jsonencode(var.authentication.administrators)
    MECHANE_MODEL_UPSTREAM           = var.model.upstream
    MECHANE_MODEL_OFFERS             = jsonencode(var.model.offers)
    MECHANE_SANDBOX_PROVIDER         = "container"
    MECHANE_SANDBOX_EGRESS           = "gateway"
    }, { for name, value in {
      MECHANE_LOGIN_KEY_LIFETIME_SECONDS             = var.authentication.login_key_lifetime_seconds
      MECHANE_NAMED_KEY_LIFETIME_SECONDS             = var.authentication.named_key_lifetime_seconds
      MECHANE_DAILY_ALLOWANCE_MICROS                 = var.budgets.new_workspace_daily_micros
      MECHANE_MECH_DAILY_CAP_MICROS                  = var.budgets.new_agent_daily_micros
      MECHANE_WORKSPACE_DAILY_ALLOWANCE_LIMIT_MICROS = var.budgets.workspace_daily_max_micros
      MECHANE_WORKSPACE_MACHINES                     = var.sandboxes.workspace_machine_limit
      MECHANE_SANDBOXES_ENABLED                      = var.sandboxes.enabled
      MECHANE_WORKSPACE_SANDBOXES_DEFAULT            = var.sandboxes.workspace_default_enabled
    } : name => tostring(value) if value != null }, var.authentication.allowed_identities == null ? {} : {
    MECHANE_ALLOWED_IDENTITIES = jsonencode(var.authentication.allowed_identities)
  })

  secret_names = {
    MECHANE_GITHUB_CLIENT_SECRET = var.secrets.github_client_secret
    MECHANE_MODEL_API_KEY        = var.secrets.model_api_key
    MECHANE_CREDENTIAL_KEYRING   = var.secrets.credential_keyring
  }
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
  adoption_baseline       = var.adoption_baseline == null ? null : jsonencode(var.adoption_baseline)
  bindings = concat(
    [{
      name         = "WORKSPACE_FILES"
      type         = "r2_bucket"
      bucket_name  = cloudflare_r2_bucket.workspace_files.name
      jurisdiction = var.storage.jurisdiction == "default" ? null : var.storage.jurisdiction
    }],
    [for name, value in local.variables : { name = name, type = "plain_text", text = value }],
    [for name, secret_name in local.secret_names : {
      name        = name
      type        = "secrets_store_secret"
      store_id    = var.secrets.store_id
      secret_name = secret_name
    }],
  )

  lifecycle {
    precondition {
      condition     = tonumber(local.variables.MECHANE_WORKSPACE_MACHINES) <= var.sandboxes.max_instances
      error_message = "A workspace machine limit cannot exceed installation capacity."
    }
    precondition {
      condition     = tonumber(local.variables.MECHANE_DAILY_ALLOWANCE_MICROS) <= tonumber(local.variables.MECHANE_WORKSPACE_DAILY_ALLOWANCE_LIMIT_MICROS)
      error_message = "The initial workspace budget cannot exceed its installation ceiling."
    }
    precondition {
      condition     = filesha256("${path.module}/${local.installation.worker.path}") == local.installation.worker.sha256
      error_message = "The Worker bundle does not match this release's installation manifest."
    }
    precondition {
      condition     = local.installation.format_version == 1
      error_message = "This module cannot read the installation manifest version."
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
  source_url    = local.installation.guest.url
  source_sha256 = local.installation.guest.sha256
  digest        = local.installation.guest.digest
}

resource "mechane_cloudflare_container_application" "sandboxes" {
  account_id                  = var.account_id
  name                        = coalesce(var.sandboxes.application_name, "${var.name}-sandboxes")
  durable_object_namespace_id = mechane_cloudflare_worker_release.release.durable_object_namespaces["SandboxObject"]
  image                       = mechane_cloudflare_container_image.guest.image
  instance_type               = var.sandboxes.instance_type
  max_instances               = var.sandboxes.max_instances
  rollout_active_grace_period = var.sandboxes.rollout_grace_seconds
  operation_timeout_seconds   = var.sandboxes.rollout_deadline_seconds
  delete_protection           = true
  logs_enabled                = true
}

resource "cloudflare_workers_custom_domain" "service" {
  for_each   = setunion(var.domain.aliases, [var.domain.hostname])
  account_id = var.account_id
  hostname   = each.value
  zone_id    = var.domain.zone_id
  service    = cloudflare_worker.service.name
  depends_on = [mechane_cloudflare_container_application.sandboxes]
}
