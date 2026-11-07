import { INSTALL_FOLDER_VARIABLE, ReleaseKey } from '@mechane/protocol';

type InstallScriptInput = { readonly origin: string };

const INSTALL_SCRIPT_BODY = `directory="\${${INSTALL_FOLDER_VARIABLE}:-$HOME/.local/bin}"

fail() {
  echo "mechane install: $*" >&2
  exit 1
}

case "$(uname -s)" in
Linux) platform=linux ;;
Darwin) platform=darwin ;;
*) fail "Mechane publishes no CLI for the system $(uname -s)" ;;
esac

case "$(uname -m)" in
x86_64 | amd64) arch=x64 ;;
aarch64 | arm64) arch=arm64 ;;
*) fail "Mechane publishes no CLI for the processor $(uname -m)" ;;
esac

field() {
  printf '%s\\n' "$1" | tr ',{}' '[\\n*]' | sed -n "s/^$(printf '"%s":' "$2")//p" | tr -d '"'
}

target="$platform-$arch"
manifest=$(curl -fsS "$origin/${ReleaseKey.Latest}")
manifest=$(printf '%s\\n' "$manifest" | tr -d ' \\t\\r\\n')
entry=$(printf '"%s":{' "$target")
release=$(field "$manifest" release)
[ -n "$release" ] || fail "$origin publishes no release"

case "$manifest" in
*"$entry"*) ;;
*) fail "release $release at $origin publishes no binary for $target" ;;
esac

binary=$(printf '%s\\n' "$manifest" | sed "s/.*$entry//; s/}.*//")
path=$(field "$binary" path)
sha256=$(field "$binary" sha256)
partial="$directory/.mechane-install-$$"

mkdir -p "$directory"
trap 'rm -f "$partial"' EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
curl -fsS -o "$partial" "$origin/$path"

if command -v sha256sum >/dev/null 2>&1; then
  digest=$(sha256sum "$partial" | cut -d ' ' -f 1)
else
  digest=$(shasum -a 256 "$partial" | cut -d ' ' -f 1)
fi

[ "$digest" = "$sha256" ] || fail "$origin/$path has SHA-256 $digest, where release $release names $sha256"
chmod 755 "$partial"
[ "$("$partial" --version)" = "mechane $release" ] || fail "$origin/$path does not report release $release"
mv -f "$partial" "$directory/mechane"
echo "installed mechane $release at $directory/mechane"
`;

export function installScript({ origin }: InstallScriptInput): string {
  const quotedOrigin = `'${origin.replaceAll("'", String.raw`'\''`)}'`;

  return ['#!/bin/sh', 'set -eu', '', `origin=${quotedOrigin}`, INSTALL_SCRIPT_BODY].join('\n');
}
