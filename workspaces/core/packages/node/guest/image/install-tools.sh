#!/bin/sh
set -eu

case "$1" in
  amd64)
    mise_arch=x64
    mise_sha=62cad463c1413f05398ca339168a8f655120b6f0b0b8adce3bc6758bafaf0602
    gh_sha=b57848131bdf0c229cd35e1f2a51aa718199858b2e728410b37e89a428943ec4
    ;;
  arm64)
    mise_arch=arm64
    mise_sha=18bf3ac02033c2a50b772b411e35528cd1888386b4316895fcae626db6ad96f3
    gh_sha=c2248526dd0160c08d3fccca2332c3c1a07c15a78b23978e77735f1b5a18cfee
    ;;
  *) exit 1 ;;
esac

curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
  "https://github.com/jdx/mise/releases/download/v2026.11.2/mise-v2026.11.2-linux-$mise_arch" -o /tmp/mise
printf '%s  /tmp/mise\n' "$mise_sha" | sha256sum --check --status
install -m 755 /tmp/mise /usr/local/bin/mise

curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
  "https://github.com/cli/cli/releases/download/v2.92.0/gh_2.92.0_linux_$1.tar.gz" -o /tmp/gh.tar.gz
printf '%s  /tmp/gh.tar.gz\n' "$gh_sha" | sha256sum --check --status
tar -xzf /tmp/gh.tar.gz -C /tmp
install -m 755 "/tmp/gh_2.92.0_linux_$1/bin/gh" /usr/local/bin/gh
rm -rf /tmp/mise /tmp/gh.tar.gz "/tmp/gh_2.92.0_linux_$1"
mise --version
gh --version
