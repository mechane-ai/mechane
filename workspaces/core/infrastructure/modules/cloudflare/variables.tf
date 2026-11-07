variable "account_id" {
  description = "Cloudflare account that owns the compute service and gateway."
  type        = string
  nullable    = false
}

variable "name" {
  description = "Permanent compute Worker identity."
  type        = string
  default     = "mechane-sandbox"
  nullable    = false

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{0,47}$", var.name))
    error_message = "Use a lowercase name of at most 48 characters, starting with a letter."
  }
}

variable "domain" {
  description = "Public HTTPS hostname and aliases forwarded to the Node service."
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

variable "runtime" {
  description = "Private Node service origin. Its authentication secret is referenced separately."
  type        = object({ origin = string })
  nullable    = false

  validation {
    condition     = can(regex("^https://[a-z0-9-]+\\.modal\\.run/?$", var.runtime.origin))
    error_message = "Supply the exact HTTPS Modal service origin without a path or query."
  }
}

variable "secrets" {
  description = "Cloudflare Secrets Store references for the private runtime transport and sandbox API."
  type = object({
    store_id          = string
    runtime_transport = string
    sandbox_service   = string
  })
  nullable = false
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
  description = "Compute capacity and explicit additional egress hosts. The Node service owns admission."
  type = object({
    application_name         = optional(string)
    instance_type            = optional(string, "standard-1")
    max_instances            = optional(number, 4)
    rollout_grace_seconds    = optional(number, 60)
    rollout_deadline_seconds = optional(number, 1200)
    additional_hosts         = optional(set(string), [])
  })
  default  = {}
  nullable = false

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
}
