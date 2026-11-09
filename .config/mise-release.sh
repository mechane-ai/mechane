#!/usr/bin/env bash

mise_release_version() {
  echo 2026.10.17
}

# These are the raw binary digests from the release's SHASUMS256.txt.
mise_release_digest() {
  case "$1" in
    linux-x64) echo fe6dd17e68e09682b31d2e7bb7bb755d22636ac1af5d94621e300f2ca9e9fe8a ;;
    linux-arm64) echo e90904144ba4377c5fbe385f429830282c68f3b4f9c690bf6c5a2ae9b74a809b ;;
    macos-arm64) echo 9e27709db5eb1e900d83149418d3067309f2a5004d4994d94246ab658ba4a3ce ;;
    macos-x64) echo dac5d6db5e315d8e4f096c6ead9279d342e09fdcb5c373d0df5c7dcce8195746 ;;
    *) echo "bootstrap: no pinned mise for $1" >&2; return 1 ;;
  esac
}
