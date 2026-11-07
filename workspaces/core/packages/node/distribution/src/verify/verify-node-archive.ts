import { Effect } from 'effect';
import type { Scope } from 'effect';
import { join } from 'node:path';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { fileDigest } from '../files/file-digest.ts';
import { readDocument } from '../files/read-document.ts';
import { runCommand } from '../files/run-command.ts';
import { temporaryFolder } from '../files/temporary-folder.ts';
import {
  isSafeArtifactPath,
  NODE_INVENTORY_FILE,
  NODE_REQUIRED_FILES,
  NodeBuild,
  NodeInventory,
  NodeRelease,
} from '../node-artifact.ts';
import type { ArtifactReceipt } from '../schemas.ts';
import type { DistributionSettings } from '../types.ts';

type VerifyNodeInput = { readonly settings: DistributionSettings; readonly receipt: ArtifactReceipt };

type VerifyExtractedInput = VerifyNodeInput & {
  readonly folder: string;
  readonly release: NodeRelease;
  readonly paths: ReadonlyArray<string>;
};

/** Checks every archived byte, with path and link validation before extraction. */
export const verifyNodeArchive = Effect.fn('verifyNodeArchive')(function* ({
  settings,
  receipt,
}: VerifyNodeInput): Effect.fn.Return<void, DistributionFailed, Scope.Scope> {
  const release = yield* readDocument({ path: join(settings.folder, 'release.json'), schema: NodeRelease });
  const artifact = receipt.assets.find((candidate) => candidate.name === release.runtime.archive);

  const hasMatchingSource =
    release.version === receipt.version &&
    release.public_commit === receipt.public_commit &&
    release.runtime.revision === receipt.public_commit;

  const hasMatchingArchive =
    artifact !== undefined && artifact.sha256 === release.runtime.sha256 && artifact.bytes === release.runtime.bytes;

  if (!hasMatchingSource || !hasMatchingArchive) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'Node release metadata differs from the verified artifact receipt',
    });
  }

  const path = join(settings.folder, release.runtime.archive);
  const listing = yield* runCommand({ command: 'tar', args: ['-tzf', path], settings });
  const details = yield* runCommand({ command: 'tar', args: ['-tvzf', path], settings });

  const paths = listing
    .trimEnd()
    .split('\n')
    .map((entry) => entry.replace(/^\.\//, '').replace(/\/$/, ''))
    .filter((entry) => entry !== '');

  const safe = paths.every((entry) => isSafeArtifactPath({ path: entry })) && new Set(paths).size === paths.length;

  const regular = details
    .trimEnd()
    .split('\n')
    .every((entry) => entry.startsWith('d') || entry.startsWith('-'));

  if (!safe || !regular) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'Node archive contains duplicate, unsafe, or non-regular entries',
    });
  }

  const folder = yield* temporaryFolder({ prefix: 'mechane-node-verify-' });

  yield* verifyExtractedNode({ settings, receipt, release, paths, folder });
}, Effect.scoped);

const verifyExtractedNode = Effect.fn('verifyExtractedNode')(function* ({
  settings,
  receipt,
  release,
  paths,
  folder,
}: VerifyExtractedInput): Effect.fn.Return<void, DistributionFailed> {
  const path = join(settings.folder, release.runtime.archive);

  yield* runCommand({ command: 'tar', args: ['-xzf', path, '-C', folder], settings });

  const inventory = yield* readDocument({ path: join(folder, NODE_INVENTORY_FILE), schema: NodeInventory });
  const build = yield* readDocument({ path: join(folder, 'release.json'), schema: NodeBuild });
  const files = inventory.files.map((file) => file.path);
  const hasMatchingBuild = build.revision === receipt.public_commit && build.version === receipt.version;

  const hasMatchingInventory =
    inventory.public_commit === receipt.public_commit &&
    inventory.version === receipt.version &&
    inventory.node_version === release.runtime.nodeVersion;

  if (!hasMatchingBuild || !hasMatchingInventory) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'Node archive inventory has invalid provenance',
    });
  }

  const hasUniqueSafeFiles =
    files.every((entry) => isSafeArtifactPath({ path: entry })) &&
    new Set(files).size === files.length &&
    !files.includes(NODE_INVENTORY_FILE);

  const hasRequiredFiles = NODE_REQUIRED_FILES.every((entry) => files.includes(entry));

  if (!hasUniqueSafeFiles || !hasRequiredFiles) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'Node archive inventory has invalid paths',
    });
  }

  const directories = new Set(
    files.flatMap((file) => {
      const parts = file.split('/');

      return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join('/'));
    }),
  );

  const expected = new Set([...files, ...directories, NODE_INVENTORY_FILE]);

  if (paths.length !== expected.size || !paths.every((entry) => expected.has(entry))) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'Node archive differs from its complete file inventory',
    });
  }

  for (const file of inventory.files) {
    const actual = yield* fileDigest({ path: join(folder, file.path) });

    if (actual.sha256 !== file.sha256 || actual.bytes !== file.bytes) {
      return yield* new DistributionFailed({
        step: DistributionStep.Verify,
        reason: `Node archive file differs from its recorded bytes: ${file.path}`,
      });
    }
  }
});
