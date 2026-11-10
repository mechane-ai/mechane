#!/bin/sh
set -eu

cd "$(dirname "$0")/.."
infrastructure_check=$(mktemp -d "${TMPDIR:-/tmp}/mechane-infrastructure-check.XXXXXX")
trap 'rm -rf "$infrastructure_check"' EXIT HUP INT TERM

tofu fmt -check -recursive infrastructure/modules infrastructure/examples
shellcheck infrastructure/check.sh infrastructure/examples/cloudflare/setup-provider.sh

provider_version=$(node --input-type=module -e 'import release from "./infrastructure/provider/release.json" with { type: "json" }; process.stdout.write(release.version)')
provider_platform=$(go env GOOS)_$(go env GOARCH)
provider_path="$infrastructure_check/providers/registry.opentofu.org/mechane-ai/mechane/$provider_version/$provider_platform"
mkdir -p "$provider_path"

(
  cd infrastructure/provider
  unformatted=$(gofmt -l .)
  if [ -n "$unformatted" ]; then
    printf '%s\n' "$unformatted" >&2
    exit 1
  fi
  go vet ./...
  go test ./...
  CGO_ENABLED=0 go build -mod=readonly -trimpath -buildvcs=false -o "$provider_path/terraform-provider-mechane_v$provider_version" .
)

node packages/node/distribution/src/main.ts preview-module "$infrastructure_check/module"
node packages/node/distribution/testing/shipped-formats.ts "$infrastructure_check/module/installation.json"
cat > "$infrastructure_check/tofurc" <<EOF
provider_installation {
  filesystem_mirror {
    path = "$infrastructure_check/providers"
    include = ["registry.opentofu.org/mechane-ai/mechane"]
  }
  direct {
    exclude = ["registry.opentofu.org/mechane-ai/mechane"]
  }
}
EOF
export TF_CLI_CONFIG_FILE="$infrastructure_check/tofurc"
tofu -chdir="$infrastructure_check/module" init -backend=false -input=false
tofu -chdir="$infrastructure_check/module" validate

mkdir "$infrastructure_check/configuration"
cp infrastructure/modules/cloudflare/variables.tf "$infrastructure_check/configuration/main.tf"
cat > "$infrastructure_check/configuration/configuration.tftest.hcl" <<'EOF'
variables {
  account_id = "example-account"
  domain = {
    hostname = "agents.example.com"
    zone_id  = "example-zone"
  }
  secrets = {
    store_id = "example-store"
    bindings = { MECHANE_SANDBOX_SERVICE_KEY = "example-sandbox" }
  }
  qualification = {
    path   = "qualification.json"
    sha256 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }
}

run "application_configuration" {
  command = plan
  variables {
    settings = { MECHANE_DEFAULT_MODEL = "example/model" }
  }
}

run "inline_credential" {
  command = plan
  variables {
    settings = { MECHANE_DATABASE_URL = "fixture-value" }
  }
  expect_failures = [var.settings]
}

run "migration_credential_binding" {
  command = plan
  variables {
    secrets = {
      store_id = "example-store"
      bindings = {
        MECHANE_SANDBOX_SERVICE_KEY   = "example-sandbox"
        MECHANE_MIGRATION_DATABASE_URL = "example-migrator"
      }
    }
  }
  expect_failures = [var.secrets]
}
EOF
tofu -chdir="$infrastructure_check/configuration" init -backend=false -input=false
tofu -chdir="$infrastructure_check/configuration" test -no-color
