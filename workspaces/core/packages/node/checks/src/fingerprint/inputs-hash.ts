import { FACTORY_FOLDER, readText } from '@mechane/checks-kernel';
import type { InputUnreadable } from '@mechane/checks-kernel';
import { sha256Hex } from '@mechane/program';
import { Effect } from 'effect';
import { basename, join } from 'node:path';

/**
 * The smoke also depends on configuration, the installation example, package manifests, and dependency locks. Their
 * content participates in the fingerprint wherever they sit.
 */
const INPUT_NAMES: ReadonlySet<string> = new Set([
  'wrangler.jsonc',
  'cloudflare.example.jsonc',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
]);

/** The folder of the sandbox image's build files, every one of which the fingerprint reads. */
const IMAGE_FOLDER = 'image';

/** The maintained notices embedded in the distributed guest, Worker and CLI artifacts. */
const LICENSES_PREFIX = 'licenses/';

/** The factory's tool lock, relative to the factory root: it pins celld, whose upgrade changes no bundle. */
const TOOL_LOCK = 'mise.lock';

type InputsHashInput = { readonly files: ReadonlyArray<string> };

/**
 * Hashes the tracked inputs besides TypeScript that the smoke reads, and the factory's tool lock, by their contents
 * alone, so a move keeps the hash.
 */
export const inputsHash = Effect.fn('inputsHash')(function* ({
  files,
}: InputsHashInput): Effect.fn.Return<string, InputUnreadable> {
  /** Whether the builds or smoke read the tracked file: a named input, an image file or an embedded notice. */
  const isInput: (file: string) => boolean = (file) =>
    INPUT_NAMES.has(basename(file)) || file.split('/').includes(IMAGE_FOLDER) || file.startsWith(LICENSES_PREFIX);

  const inputs = [...files.filter(isInput), join(FACTORY_FOLDER, TOOL_LOCK)];
  const texts = yield* Effect.forEach(inputs, (path) => readText({ path }), { concurrency: 1 });
  const hashes = texts.map((text) => sha256Hex({ contents: text })).toSorted();

  return sha256Hex({ contents: hashes.join('\n') });
});
