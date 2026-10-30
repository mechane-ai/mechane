terraform {
  required_version = ">= 1.13.0, < 2.0.0"
  required_providers {
    cloudflare = { source = "cloudflare/cloudflare", version = "5.28.1" }
    mechane    = { source = "mechane-ai/mechane", version = "0.7.0" }
  }
}

provider "cloudflare" {}
provider "mechane" {}

module "mechane" {
  source     = "https://github.com/mechane-ai/mechane/releases/download/v0.7.0/mechane-cloudflare-v0.7.0.zip"
  account_id = "YOUR_CLOUDFLARE_ACCOUNT_ID"
  name       = "mechane"
  domain = {
    hostname = "agents.example.com"
    zone_id  = "YOUR_CLOUDFLARE_ZONE_ID"
  }
  authentication = {
    github_client_id   = "YOUR_GITHUB_OAUTH_CLIENT_ID"
    administrators     = [{ provider = "github", subject = "123456" }]
    allowed_identities = [{ provider = "github", subject = "123456" }]
  }
  secrets = {
    store_id             = "YOUR_SECRETS_STORE_ID"
    github_client_secret = "mechane-github-client-secret"
    model_api_key        = "mechane-model-api-key"
    credential_keyring   = "mechane-credential-keyring"
  }
  # Review the catalog snapshot in docs/cloudflare-setup.md before changing model caps or prices.
  model = {
    upstream = "https://openrouter.ai/api/v1"
    offers = [{
      id                                    = "anthropic/claude-haiku-5.5"
      context_window_tokens                 = 65536
      max_output_tokens                     = 4096
      input_micros_per_million_tokens       = 100000
      output_micros_per_million_tokens      = 500000
      cache_read_micros_per_million_tokens  = 10000
      cache_write_micros_per_million_tokens = 125000
    }]
  }
}

output "origin" {
  value = module.mechane.origin
}
