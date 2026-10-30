terraform {
  required_version = ">= 1.13.0, < 2.0.0"
  required_providers {
    cloudflare = { source = "cloudflare/cloudflare", version = "5.28.1" }
    mechane    = { source = "mechane-ai/mechane", version = "0.6.1" }
  }
}

provider "cloudflare" {}
provider "mechane" {}

module "mechane" {
  source     = "https://github.com/mechane-ai/mechane/releases/download/v0.6.1/mechane-cloudflare-v0.6.1.zip"
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
  model = {
    upstream = "https://models.example.com/v1"
    offers = [{
      id                                    = "REPLACE_WITH_YOUR_MODEL"
      context_window_tokens                 = 32768
      max_output_tokens                     = 4096
      input_micros_per_million_tokens       = 1000000
      output_micros_per_million_tokens      = 5000000
      cache_read_micros_per_million_tokens  = 100000
      cache_write_micros_per_million_tokens = 1250000
    }]
  }
}

output "origin" {
  value = module.mechane.origin
}
