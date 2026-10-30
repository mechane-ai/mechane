#!/bin/sh
set -eu

cd "$(dirname "$0")/.."
infrastructure_check=$(mktemp -d "${TMPDIR:-/tmp}/mechane-infrastructure-check.XXXXXX")
trap 'rm -rf "$infrastructure_check"' EXIT HUP INT TERM

tofu fmt -check -recursive infrastructure/modules
shellcheck infrastructure/check.sh

provider_version=$(node --input-type=module -e 'import { RELEASE } from "./packages/shared/protocol/src/release.ts"; process.stdout.write(RELEASE)')
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
