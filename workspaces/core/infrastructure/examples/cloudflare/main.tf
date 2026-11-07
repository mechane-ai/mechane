terraform {
  required_version = ">= 1.13.0, < 2.0.0"
  required_providers {
    cloudflare = { source = "cloudflare/cloudflare", version = "5.28.1" }
    mechane    = { source = "mechane-ai/mechane", version = "0.10.0" }
  }
}

provider "cloudflare" {}
provider "mechane" {}

module "mechane" {
  source     = "https://github.com/mechane-ai/mechane/releases/download/v0.25.2/mechane-cloudflare-v0.25.2.zip"
  account_id = "YOUR_CLOUDFLARE_ACCOUNT_ID"
  name       = "mechane-sandbox"
  domain = {
    hostname = "agents.example.com"
    zone_id  = "YOUR_CLOUDFLARE_ZONE_ID"
  }
  runtime = {
    origin = "https://your-workspace--mechane-runtime.us-east.modal.direct"
  }
  secrets = {
    store_id          = "YOUR_SECRETS_STORE_ID"
    runtime_transport = "mechane-runtime-transport"
    sandbox_service   = "mechane-sandbox-service"
  }
}

output "origin" {
  value = module.mechane.origin
}
