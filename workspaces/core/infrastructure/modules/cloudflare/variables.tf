variable "account_id" {
  description = "Cloudflare account that owns the application and environment resources."
  type        = string
  nullable    = false
}

variable "name" {
  description = "Permanent application Worker identity. Preserve the existing name during upgrades."
  type        = string
  default     = "mechane-sandbox"
  nullable    = false

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{0,47}$", var.name))
    error_message = "Use a lowercase name of at most 48 characters, starting with a letter."
  }
}

variable "domain" {
  description = "Public HTTPS hostname and aliases served by the application Worker."
  type = object({
    hostname = string
    zone_id  = string
    aliases  = optional(set(string), [])
  })
  nullable = false

  validation {
    condition = alltrue([
      for hostname in setunion(var.domain.aliases, [var.domain.hostname]) :
      can(regex("^[a-z0-9][a-z0-9.-]*\\.[a-z]{2,}$", hostname))
    ])
    error_message = "Supply hostnames without a scheme, path, port, or wildcard."
  }
}

variable "qualification" {
  description = "Pinned qualification receipt and adjacent immutable candidate files, inputs, and check evidence."
  type = object({
    path   = string
    sha256 = string
  })
  nullable = false

  validation {
    condition     = length(var.qualification.path) > 0 && can(regex("^[0-9a-f]{64}$", var.qualification.sha256))
    error_message = "Supply the qualification receipt path and its complete lowercase SHA-256 digest."
  }
}

variable "settings" {
  description = "Non-secret application settings. The module owns origins and environment resource settings."
  type        = map(string)
  default     = {}
  nullable    = false

  validation {
    condition = alltrue([
      for name in keys(var.settings) : can(regex("^MECHANE_[A-Z0-9_]+$", name)) &&
      !contains(["MECHANE_DATABASE_URL", "MECHANE_MIGRATION_DATABASE_URL", "MECHANE_CREDENTIAL_KEYRING", "MECHANE_MODEL_UPSTREAM_KEY", "MECHANE_GITHUB_CLIENT_SECRET", "MECHANE_SANDBOX_SERVICE_KEY", "MECHANE_NEXUS_SIGNING_SECRET"], name)
    ])
    error_message = "Supply named non-secret MECHANE settings; database, model, OAuth, signing, and encryption credentials require secret references."
  }
}

variable "secrets" {
  description = "Cloudflare Secrets Store names keyed by application binding. Credential values never enter state."
  type = object({
    store_id = string
    bindings = map(string)
  })
  nullable = false

  validation {
    condition = length(var.secrets.store_id) > 0 && contains(keys(var.secrets.bindings), "MECHANE_SANDBOX_SERVICE_KEY") && alltrue([
      for name, secret_name in var.secrets.bindings : can(regex("^MECHANE_[A-Z0-9_]+$", name)) && length(secret_name) > 0 && !contains(["MECHANE_MIGRATION_DATABASE_URL", "MECHANE_RUNTIME_TRANSPORT", "MECHANE_SANDBOX_KEY"], name)
    ])
    error_message = "Supply the shared sandbox service key and application secret references. Migration credentials and retired transport aliases cannot be Worker bindings."
  }
}

variable "storage" {
  description = "The bucket containing sandbox filesystem checkpoints."
  type = object({
    workspace_bucket_name = optional(string)
    jurisdiction          = optional(string, "default")
    location              = optional(string)
  })
  default  = {}
  nullable = false
}

variable "sandboxes" {
  description = "Compute capacity, installed tools, and browser egress. The application owns admission."
  type = object({
    application_name         = optional(string)
    instance_type            = optional(string, "standard-1")
    max_instances            = optional(number, 4)
    rollout_grace_seconds    = optional(number, 60)
    rollout_deadline_seconds = optional(number, 1200)
    additional_hosts         = optional(set(string), [])
    web_access               = optional(string, "packages")
    browser_sandbox_disabled = optional(bool, false)
    additional_tools = optional(list(object({
      name           = string
      version        = string
      version_output = string
      targets = map(object({
        url        = string
        sha256     = string
        executable = string
      }))
    })), [])
  })
  default  = {}
  nullable = false

  validation {
    condition     = contains(["packages", "public"], var.sandboxes.web_access)
    error_message = "Sandbox web access must be packages or public. Both modes retain the outbound gateway."
  }

  validation {
    condition     = var.sandboxes.max_instances >= 1 && floor(var.sandboxes.max_instances) == var.sandboxes.max_instances
    error_message = "Compute capacity must be a positive integer."
  }

  validation {
    condition = length(var.sandboxes.additional_hosts) <= 64 && alltrue([
      for hostname in var.sandboxes.additional_hosts :
      length(hostname) <= 253 && can(regex("^([a-z0-9]([a-z0-9-]*[a-z0-9])?\\.)+[a-z]{2,63}$", hostname))
    ])
    error_message = "Use at most 64 exact public hostnames without schemes, ports, wildcards or literal addresses."
  }

  validation {
    condition = length(var.sandboxes.additional_tools) <= 8 && length(distinct([
      for tool in var.sandboxes.additional_tools : tool.name
      ])) == length(var.sandboxes.additional_tools) && alltrue([
      for tool in var.sandboxes.additional_tools :
      can(regex("^[a-z][a-z0-9-]{0,63}$", tool.name)) &&
      length(tool.version) > 0 && length(tool.version) <= 64 &&
      length(tool.version_output) > 0 && length(tool.version_output) <= 256 &&
      !can(regex("[[:cntrl:]]", tool.version_output)) &&
      length(tool.targets) > 0 && alltrue([
        for target, archive in tool.targets :
        contains(["linux-x64", "linux-arm64", "darwin-arm64"], target) &&
        length(archive.url) <= 2048 && can(regex("^https://[^/@?#]+/[^?#]*$", archive.url)) &&
        can(regex("^[0-9a-f]{64}$", archive.sha256)) &&
        length(archive.executable) <= 1024 &&
        can(regex("^[a-zA-Z0-9_][a-zA-Z0-9._-]*(/[a-zA-Z0-9_][a-zA-Z0-9._-]*)*$", archive.executable))
      ])
    ])
    error_message = "Supply at most eight distinct pinned tools with an exact version output, supported targets, credential-free HTTPS archive URLs, SHA-256 digests, and relative executable paths."
  }
}
