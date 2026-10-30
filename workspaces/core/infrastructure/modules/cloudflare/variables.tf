variable "account_id" {
  description = "Cloudflare account that owns the installation."
  type        = string
  nullable    = false
}

variable "name" {
  description = "Permanent Worker name. Changing this identity creates a different installation."
  type        = string
  default     = "mechane"
  nullable    = false

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{0,47}$", var.name))
    error_message = "Use a lowercase name of at most 48 characters, starting with a letter."
  }
}

variable "domain" {
  description = "Primary HTTPS hostname and optional aliases in the same Cloudflare zone."
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

variable "authentication" {
  description = "GitHub OAuth client and stable provider subjects admitted to administer or use this installation. A null allowlist permits any GitHub identity."
  type = object({
    github_client_id           = string
    login_key_lifetime_seconds = optional(number, 2592000)
    named_key_lifetime_seconds = optional(number, 31536000)
    administrators = set(object({
      provider = string
      subject  = string
    }))
    allowed_identities = optional(set(object({
      provider = string
      subject  = string
    })))
  })
  nullable = false

  validation {
    condition = alltrue([
      for seconds in [var.authentication.login_key_lifetime_seconds, var.authentication.named_key_lifetime_seconds] :
      seconds >= 1 && seconds <= 31536000 && floor(seconds) == seconds
    ])
    error_message = "API key lifetimes must be whole seconds between one and 365 days."
  }

  validation {
    condition = length(var.authentication.administrators) > 0 && alltrue([
      for identity in setunion(var.authentication.administrators, coalesce(var.authentication.allowed_identities, [])) :
      identity.provider == "github" && can(regex("^[0-9]+$", identity.subject))
    ])
    error_message = "Name at least one administrator. GitHub subjects are numeric user IDs, not login names."
  }
}

variable "secrets" {
  description = "Existing Cloudflare Secrets Store references. Values are read by the Worker and never supplied to OpenTofu."
  type = object({
    store_id             = string
    github_client_secret = string
    model_api_key        = string
    credential_keyring   = string
  })
  nullable = false
}

variable "model" {
  description = "OpenAI-compatible upstream and the model offers priced in micro-dollars per million tokens."
  type = object({
    upstream = string
    offers = list(object({
      id                                    = string
      context_window_tokens                 = number
      max_output_tokens                     = number
      input_micros_per_million_tokens       = number
      output_micros_per_million_tokens      = number
      cache_read_micros_per_million_tokens  = number
      cache_write_micros_per_million_tokens = number
    }))
  })
  nullable = false

  validation {
    condition     = can(regex("^https://[^/]+", var.model.upstream)) && length(var.model.offers) > 0
    error_message = "Supply an HTTPS model endpoint and at least one model offer."
  }
}

variable "storage" {
  description = "Persistent workspace bucket identity. Set its name when importing an existing installation."
  type = object({
    workspace_bucket_name = optional(string)
    jurisdiction          = optional(string, "default")
    location              = optional(string)
  })
  default  = {}
  nullable = false
}

variable "sandboxes" {
  description = "Installation capacity. Per-workspace admission and limits are managed through Mechane's administration API."
  type = object({
    application_name          = optional(string)
    instance_type             = optional(string, "standard-1")
    max_instances             = optional(number, 4)
    workspace_machine_limit   = optional(number, 4)
    enabled                   = optional(bool, true)
    workspace_default_enabled = optional(bool, true)
    rollout_grace_seconds     = optional(number, 60)
    rollout_deadline_seconds  = optional(number, 1200)
  })
  default  = {}
  nullable = false

  validation {
    condition = (
      var.sandboxes.max_instances >= 1 && floor(var.sandboxes.max_instances) == var.sandboxes.max_instances &&
      var.sandboxes.workspace_machine_limit >= 1 &&
      floor(var.sandboxes.workspace_machine_limit) == var.sandboxes.workspace_machine_limit &&
      var.sandboxes.workspace_machine_limit <= var.sandboxes.max_instances
    )
    error_message = "Machine counts must be positive integers; a workspace cannot exceed installation capacity."
  }
}

variable "budgets" {
  description = "Initial budgets and the installation ceiling, in micro-dollars. Existing workspace budgets remain runtime data."
  type = object({
    new_workspace_daily_micros = optional(number, 20000000)
    new_agent_daily_micros     = optional(number, 10000000)
    workspace_daily_max_micros = optional(number, 20000000)
  })
  default  = {}
  nullable = false

  validation {
    condition = alltrue([
      for amount in values(var.budgets) : amount >= 0 && floor(amount) == amount
    ]) && var.budgets.new_workspace_daily_micros <= var.budgets.workspace_daily_max_micros
    error_message = "Budgets must be whole nonnegative micro-dollars; the initial workspace budget cannot exceed its ceiling."
  }
}

variable "adoption_baseline" {
  description = "One-time reviewed format baseline for a live Worker deployed before immutable installation manifests."
  type = object({
    release_version   = string
    worker_version_id = string
    bundle_sha256     = string
    formats = object({
      wire       = map(list(string))
      migrations = map(list(string))
    })
  })
  default = null
}
