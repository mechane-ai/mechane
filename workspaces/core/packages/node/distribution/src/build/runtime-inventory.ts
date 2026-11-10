import { JSON_INDENT_CHARS, sha256Hex } from '@mechane/program';
import { RELEASE } from '@mechane/protocol';
import { Effect } from 'effect';
import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { DistributionStep, FORMAT_VERSION } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { fileDigest } from '../files/file-digest.ts';
import { readDocument } from '../files/read-document.ts';
import {
  isSafeArtifactPath,
  RUNTIME_INVENTORY_FILE,
  RUNTIME_OUTPUT_FOLDER,
  RUNTIME_REQUIRED_FILES,
  RuntimeBuild,
} from '../runtime-artifact.ts';
import type { RuntimeFile, RuntimeInventory } from '../runtime-artifact.ts';

type InventoryInput = { readonly commit: string; readonly isPreview: boolean };

export const runtimeInventory = Effect.fn('runtimeInventory')(function* ({
  commit,
  isPreview,
}: InventoryInput): Effect.fn.Return<RuntimeInventory, DistributionFailed> {
  const entries = yield* Effect.tryPromise({
    try: () => readdir(RUNTIME_OUTPUT_FOLDER, { recursive: true, withFileTypes: true }),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Read, reason: String(cause) }),
  });

  const files: Array<RuntimeFile> = [];

  for (const entry of entries) {
    const source = join(entry.parentPath, entry.name);
    const path = relative(RUNTIME_OUTPUT_FOLDER, source);

    const isRegularEntry = entry.isFile() || entry.isDirectory();
    const isIncludedPath = isSafeArtifactPath({ path }) && path !== RUNTIME_INVENTORY_FILE;

    if (!isRegularEntry || !isIncludedPath) {
      return yield* new DistributionFailed({ step: DistributionStep.Verify, reason: `unsafe runtime output: ${path}` });
    }

    if (entry.isFile() && path !== 'release.json') {
      const digest = yield* fileDigest({ path: source });

      files.push({ path, ...digest });
    }
  }

  const build = yield* readDocument({ path: join(RUNTIME_OUTPUT_FOLDER, 'build.json'), schema: RuntimeBuild });
  const hasEveryFile = RUNTIME_REQUIRED_FILES.every((path) => files.some((file) => file.path === path));

  const hasMatchingRevision = build.version === RELEASE && build.revision === commit;
  const isWrongRelease = !isPreview && !hasMatchingRevision;

  if (!hasEveryFile || isWrongRelease) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'runtime output is incomplete or belongs to another source revision',
    });
  }

  return {
    format_version: FORMAT_VERSION,
    version: RELEASE,
    public_commit: commit,
    files: files.toSorted((left, right) => left.path.localeCompare(right.path)),
  };
});

type InventoryFileInput = { readonly inventory: RuntimeInventory };

export function inventoryFile({ inventory }: InventoryFileInput): RuntimeFile {
  const contents = `${JSON.stringify(inventory, undefined, JSON_INDENT_CHARS)}\n`;
  const sha256 = sha256Hex({ contents });

  return { path: RUNTIME_INVENTORY_FILE, sha256, bytes: Buffer.byteLength(contents) };
}
