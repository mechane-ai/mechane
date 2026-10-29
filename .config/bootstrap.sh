#!/usr/bin/env bash
# Prepares a fresh machine or cloud agent: the pinned mise, the tools mise.lock records, and the locked packages.
set -euo pipefail

root=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
bin="$HOME/.local/bin"
mise_version=2026.10.17
caller_path=$PATH
export PATH="$bin:$PATH"
# Install the repository's locked tools without inheriting unrelated personal or system tool declarations.
export MISE_CONFIG_DIR=/dev/null
export MISE_SYSTEM_CONFIG_DIR=/dev/null

# The SHA-256 digest of each mise release asset, from the release's SHASUMS256.txt.
mise_digest() {
  case "$1" in
    linux-x64) echo fe6dd17e68e09682b31d2e7bb7bb755d22636ac1af5d94621e300f2ca9e9fe8a ;;
    linux-arm64) echo e90904144ba4377c5fbe385f429830282c68f3b4f9c690bf6c5a2ae9b74a809b ;;
    macos-arm64) echo 9e27709db5eb1e900d83149418d3067309f2a5004d4994d94246ab658ba4a3ce ;;
    macos-x64) echo dac5d6db5e315d8e4f096c6ead9279d342e09fdcb5c373d0df5c7dcce8195746 ;;
    *) echo "bootstrap: no pinned mise for $1" >&2; exit 1 ;;
  esac
}

platform() {
  local os arch
  case "$(uname -s)" in
    Linux) os=linux ;;
    Darwin) os=macos ;;
    *) echo "bootstrap: no mise build for $(uname -s)" >&2; exit 1 ;;
  esac
  case "$(uname -m)" in
    x86_64 | amd64) arch=x64 ;;
    arm64 | aarch64) arch=arm64 ;;
    *) echo "bootstrap: no mise build for $(uname -m)" >&2; exit 1 ;;
  esac
  echo "$os-$arch"
}

verify() {
  if command -v sha256sum >/dev/null; then
    echo "$1  $2" | sha256sum -c --quiet
  else
    echo "$1  $2" | shasum -a 256 -c --quiet
  fi
}

install_mise() {
  if command -v mise >/dev/null && [ "$(mise --version | cut -d ' ' -f 1)" = "$mise_version" ]; then
    return
  fi
  local target file
  target=$(platform)
  file=$(mktemp)
  curl -fsSL -o "$file" "https://github.com/jdx/mise/releases/download/v$mise_version/mise-v$mise_version-$target"
  verify "$(mise_digest "$target")" "$file"
  mkdir -p "$bin"
  install -m 0755 "$file" "$bin/mise"
  rm "$file"
}

install_mise
cd "$root"
# A merge or rebase across a folder move then carries a branch's new file into the moved folder.
git config merge.directoryRenames true
# A merge of two versions of a ratchet's baseline keeps each file's smaller count; git runs drivers from the top level.
git config merge.baseline-min.name "the smaller count of each file of a ratchet's baseline"
git config merge.baseline-min.driver 'node workspaces/core/packages/node/checks/src/main.ts merge %O %A %B'
# A merge of a file the rule registry generates keeps this side, and `mise run fix` writes it again from the registry.
git config merge.ours.name "this side of a file the rule registry generates"
git config merge.ours.driver true
mise trust --quiet "$root/mise.toml"
mise trust --quiet "$root/workspaces/core/mise.toml"
mise install
mise run setup

case ":$caller_path:" in
  *":$bin:"*) ;;
  *) echo "bootstrap: mise is in $bin; run export PATH=\"$bin:\$PATH\" before mise run check" >&2 ;;
esac
