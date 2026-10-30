terraform {
  required_version = ">= 1.13.0, < 2.0.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "5.28.1"
    }
    mechane = {
      source  = "mechane-ai/mechane"
      version = "0.7.0"
    }
  }
}
