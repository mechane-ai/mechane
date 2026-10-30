#!/bin/sh
set -eu

if [ "$#" -ne 1 ] || ! printf '%s\n' "$1" | LC_ALL=C grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  printf 'Usage: sh setup-provider.sh VERSION (from your OpenTofu directory)\n' >&2
  exit 1
fi

for command in curl gpg openssl; do
  if ! command -v "$command" >/dev/null 2>&1; then
    printf 'Provider setup requires %s on PATH.\n' "$command" >&2
    exit 1
  fi
done

case "$(uname -s)" in
  Darwin) operating_system=darwin ;;
  Linux) operating_system=linux ;;
  *) printf 'Provider setup supports macOS and Linux.\n' >&2; exit 1 ;;
esac
case "$(uname -m)" in
  arm64 | aarch64) architecture=arm64 ;;
  x86_64 | amd64) architecture=amd64 ;;
  *) printf 'Provider setup supports amd64 and arm64.\n' >&2; exit 1 ;;
esac

version=$1
prefix="terraform-provider-mechane_$version"
archive="${prefix}_${operating_system}_${architecture}.zip"
release="https://github.com/mechane-ai/terraform-provider-mechane/releases/download/v$version"
fingerprint=2229E3931B4A4739A439C9A357BF85C24B6B0DFA
configuration_directory=$(pwd -P)
case "$configuration_directory" in
  *'
'* | *''*) printf 'Provider setup requires a directory path without line breaks.\n' >&2; exit 1 ;;
esac

umask 077
mkdir -p .mechane
temporary=$(mktemp -d "$configuration_directory/.mechane/provider-setup.XXXXXX")
trap 'rm -rf "$temporary"' EXIT
trap 'exit 1' HUP INT TERM
mirror="$configuration_directory/.mechane/provider-mirror"
mirror_hcl=$(printf '%s' "$mirror" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\${/$${/g; s/%{/%%{/g')
cat > "$temporary/tofurc" <<EOF
provider_installation {
  filesystem_mirror {
    path    = "$mirror_hcl"
    include = ["registry.opentofu.org/mechane-ai/mechane"]
  }
  direct {
    exclude = ["registry.opentofu.org/mechane-ai/mechane"]
  }
}
EOF
if [ -e .mechane/tofurc ] && ! cmp -s .mechane/tofurc "$temporary/tofurc"; then
  printf 'Provider setup refuses to replace the existing .mechane/tofurc configuration.\n' >&2
  exit 1
fi

download() {
  curl --disable --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
    --connect-timeout 15 --max-time 300 --retry 3 --output "$temporary/$1" "$release/$1"
}

download "${prefix}_SHA256SUMS"
download "${prefix}_SHA256SUMS.sig"
download "${prefix}_public-key.asc"
mkdir "$temporary/gnupg"
gpg --no-options --batch --homedir "$temporary/gnupg" --output "$temporary/public.gpg" \
  --dearmor "$temporary/${prefix}_public-key.asc"
if ! gpg --no-options --batch --homedir "$temporary/gnupg" --no-default-keyring \
  --keyring "$temporary/public.gpg" --no-auto-key-retrieve --status-fd 1 \
  --verify "$temporary/${prefix}_SHA256SUMS.sig" "$temporary/${prefix}_SHA256SUMS" \
  > "$temporary/signature.status" 2> "$temporary/signature.log"; then
  printf 'Provider setup could not verify the release checksum signature.\n' >&2
  exit 1
fi
if ! awk -v fingerprint="$fingerprint" '
  $2 == "VALIDSIG" { count++; if ($3 == fingerprint || $NF == fingerprint) trusted++ }
  END { exit !(count == 1 && trusted == 1) }
' "$temporary/signature.status"; then
  printf 'Provider setup rejected an unexpected signing key.\n' >&2
  exit 1
fi

expected=$(awk -v archive="$archive" '$2 == archive { print $1 }' "$temporary/${prefix}_SHA256SUMS")
if ! printf '%s\n' "$expected" | LC_ALL=C grep -Eq '^[0-9a-f]{64}$'; then
  printf 'Provider setup could not find the platform archive in the signed checksums.\n' >&2
  exit 1
fi
download "$archive"
actual=$(openssl dgst -sha256 "$temporary/$archive" | awk '{ print $NF }')
if [ "$actual" != "$expected" ]; then
  printf 'Provider setup rejected an archive that differs from its signed checksum.\n' >&2
  exit 1
fi

package_directory="$mirror/registry.opentofu.org/mechane-ai/mechane"
mkdir -p "$package_directory"
mv "$temporary/$archive" "$package_directory/$archive"
mv "$temporary/tofurc" .mechane/tofurc
printf 'Verified Mechane provider %s for %s_%s with signing key %s.\n' \
  "$version" "$operating_system" "$architecture" "$fingerprint"
printf 'Run OpenTofu with TF_CLI_CONFIG_FILE set to: %s/.mechane/tofurc\n' "$configuration_directory"
