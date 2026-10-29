import { INSTALL_FOLDER_VARIABLE, ReleaseKey } from '@mechane/protocol';
import { HttpHeader, MediaType } from '@mechane/records';
import { shellWord } from '@mechane/utilities';
import { Effect } from 'effect';
import { cacheControl } from './cache-control.ts';
import { REPLACED_FILE_LIFETIME } from './constants.ts';
import type { ServeRelease } from './types.ts';

/** The caching of the install script, which each deploy replaces. */
const INSTALL_SCRIPT_CACHE = cacheControl({ maxAge: REPLACED_FILE_LIFETIME, isImmutable: false });

/**
 * The install script after the line that sets its deployment's origin. It renames the binary of the release the latest
 * manifest names into place only once its SHA-256 matches and it reports that release, reading the manifest as text. A
 * signal exits through the exit trap, which removes the partial download, since dash runs none when a signal kills it.
 */
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

# The manifest is JSON without spaces in its values; a field is the text after its quoted name, without quotes.
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

/**
 * Answers with the POSIX shell script that installs the CLI from this deployment's origin, as text a person can read
 * before piping it to `sh`.
 */
export const serveInstallScript: ServeRelease = ({ settings }) => {
  const text = [
    '#!/bin/sh',
    '# Installs the mechane CLI from the deployment at its origin.',
    'set -eu',
    '',
    `origin=${shellWord({ text: settings.origin.origin })}`,
    INSTALL_SCRIPT_BODY,
  ].join('\n');

  const bytes = new TextEncoder().encode(text);

  const headers = {
    [HttpHeader.ContentType]: MediaType.Utf8PlainText,
    [HttpHeader.CacheControl]: INSTALL_SCRIPT_CACHE,
    [HttpHeader.ContentLength]: String(bytes.byteLength),
  };

  return Effect.succeed(new Response(bytes, { headers }));
};
