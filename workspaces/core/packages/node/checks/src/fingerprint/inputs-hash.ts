import { FACTORY_FOLDER, readText } from '@mechane/checks-kernel';
import type { InputUnreadable } from '@mechane/checks-kernel';
import { sha256Hex } from '@mechane/program';
import { FileRole } from '@mechane/rule-shapes';
import { FILE_ROLES } from '@mechane/rules';
import { Array, Effect } from 'effect';
import { basename, join, matchesGlob } from 'node:path';

/**
 * The smoke also depends on runtime configuration, package manifests, and dependency locks. Their content participates
 * in the fingerprint wherever they sit.
 */
const INPUT_NAMES: ReadonlySet<string> = new Set([
  'wrangler.jsonc',
  'package.json',
  'mise.toml',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
]);

/** The folder of the sandbox image's build files, every one of which the fingerprint reads. */
const IMAGE_FOLDER = 'image';

/** The maintained notices embedded in the distributed guest, Worker and CLI artifacts. */
const LICENSES_PREFIX = 'licenses/';

/** The factory toolchain and task configuration affect every compiled artifact and its qualification. */
const FACTORY_INPUTS = ['mise.toml', 'mise.lock'] as const;

type InputsHashInput = { readonly files: ReadonlyArray<string> };

/**
 * Hashes tracked build inputs outside program bundles, including embedded browser assets and factory configuration.
 * Paths participate because moving a public asset can change its URL without changing its contents.
 */
export const inputsHash = Effect.fn('inputsHash')(function* ({
  files,
}: InputsHashInput): Effect.fn.Return<string, InputUnreadable> {
  /** Browser source, configuration and assets share the registry's browser scope, including conservative extras. */
  const isBrowserInput: (file: string) => boolean = (file) =>
    FILE_ROLES[FileRole.Browser].some((pattern) => matchesGlob(file, pattern));

  /** Whether the builds or smoke read the tracked file: browser input, build script, image or embedded notice. */
  const isInput: (file: string) => boolean = (file) => {
    if (isBrowserInput(file)) {
      return true;
    }

    const isBuildScript = file.endsWith('.mjs');
    const isBundledAsset = file.split('/').includes(IMAGE_FOLDER) || file.startsWith(LICENSES_PREFIX);

    return INPUT_NAMES.has(basename(file)) || isBuildScript || isBundledAsset;
  };

  const factoryInputs = FACTORY_INPUTS.map((path) => join(FACTORY_FOLDER, path));
  const inputs = [...files.filter(isInput), ...factoryInputs];
  const texts = yield* Effect.forEach(inputs, (path) => readText({ path }), { concurrency: 1 });
  const sources = Array.zip(inputs, texts);
  const hashes = sources.map(([path, text]) => sha256Hex({ contents: `${path}\n${text}` })).toSorted();

  return sha256Hex({ contents: hashes.join('\n') });
});
