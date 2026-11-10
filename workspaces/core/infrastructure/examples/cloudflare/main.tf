terraform {
  required_version = ">= 1.13.0, < 2.0.0"
  required_providers {
    cloudflare = { source = "cloudflare/cloudflare", version = "5.28.1" }
    mechane    = { source = "mechane-ai/mechane", version = "0.11.0" }
  }
}

provider "cloudflare" {}
provider "mechane" {}

module "mechane" {
  source     = "https://github.com/mechane-ai/mechane/releases/download/v0.28.0/mechane-cloudflare-v0.28.0.zip"
  account_id = "YOUR_CLOUDFLARE_ACCOUNT_ID"
  name       = "mechane-sandbox"
  domain = {
    hostname = "agents.example.com"
    zone_id  = "YOUR_CLOUDFLARE_ZONE_ID"
  }
  qualification = {
    path   = "/path/to/qualified-candidate/qualification.json"
    sha256 = "REPLACE_WITH_QUALIFICATION_SHA256"
  }
  settings = {
    MECHANE_GITHUB_CLIENT_ID = "YOUR_GITHUB_OAUTH_CLIENT_ID"
  }
  secrets = {
    store_id = "YOUR_SECRETS_STORE_ID"
    bindings = {
      MECHANE_DATABASE_URL         = "mechane-database-runtime"
      MECHANE_CREDENTIAL_KEYRING   = "mechane-credential-keyring"
      MECHANE_MODEL_UPSTREAM_KEY   = "mechane-model-upstream-key"
      MECHANE_GITHUB_CLIENT_SECRET = "mechane-github-client-secret"
      MECHANE_SANDBOX_SERVICE_KEY  = "mechane-sandbox-service"
    }
  }
}

output "origin" {
  value = module.mechane.origin
}
