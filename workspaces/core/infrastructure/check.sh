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

mkdir "$infrastructure_check/runtime-origin"
cp infrastructure/modules/cloudflare/variables.tf "$infrastructure_check/runtime-origin/main.tf"
cat > "$infrastructure_check/runtime-origin/origin.tftest.hcl" <<'EOF'
variables {
  account_id = "example-account"
  domain = {
    hostname = "agents.example.com"
    zone_id  = "example-zone"
  }
  secrets = {
    store_id          = "example-store"
    runtime_transport = "example-runtime"
    sandbox_service   = "example-sandbox"
  }
}

run "regional_runtime_origin" {
  command = plan
  variables {
    runtime = { origin = "https://example--runtime.us-east.modal.direct" }
  }
}

run "runtime_suffix_lookalike" {
  command = plan
  variables {
    runtime = { origin = "https://example--runtime.us-east.modal.direct.evil.example" }
  }
  expect_failures = [var.runtime]
}
EOF
tofu -chdir="$infrastructure_check/runtime-origin" init -backend=false -input=false
tofu -chdir="$infrastructure_check/runtime-origin" test -no-color
