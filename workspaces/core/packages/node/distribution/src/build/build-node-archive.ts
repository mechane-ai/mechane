import { RELEASE, RELEASE_REPOSITORY } from '@mechane/protocol';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { constants } from 'node:fs';
import { copyFile, cp, readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { ARTIFACT_NOTICE_NAMES, DistributionStep, FORMAT_VERSION, SOURCE_FOLDER } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { assetName } from '../files/asset-name.ts';
import { fileDigest } from '../files/file-digest.ts';
import { readDocument } from '../files/read-document.ts';
import { runCommand } from '../files/run-command.ts';
import { temporaryFolder } from '../files/temporary-folder.ts';
import { writeDocument } from '../files/write-document.ts';
import {
  isSafeArtifactPath,
  NODE_ENTRYPOINT,
  NODE_GRANT_ENTRYPOINT,
  NODE_INVENTORY_FILE,
  NODE_MIGRATION_ENTRYPOINT,
  NODE_OUTPUT_FOLDER,
  NODE_REQUIRED_FILES,
  NodeBuild,
  WORKFLOW_MIGRATION_ENTRYPOINT,
} from '../node-artifact.ts';
import type { NodeInventory, NodeRelease } from '../node-artifact.ts';
import type { Artifact } from '../schemas.ts';
import type { DistributionSettings } from '../types.ts';

type BuildNodeInput = { readonly settings: DistributionSettings; readonly commit: string };
type StageNodeInput = BuildNodeInput & { readonly folder: string };
type NodeFileInput = { readonly folder: string; readonly path: string };

/** Builds one OS-independent archive from compiled modules and their exact runtime assets. */
export const buildNodeArchive = Effect.fn('buildNodeArchive')(function* ({
  settings,
  commit,
}: BuildNodeInput): Effect.fn.Return<ReadonlyArray<Artifact>, DistributionFailed, Scope.Scope> {
  const staging = yield* temporaryFolder({ prefix: 'mechane-node-release-' });
  const folder = join(staging, 'runtime');

  return yield* stageNodeArchive({ settings, commit, folder });
}, Effect.scoped);

const stageNodeArchive = Effect.fn('stageNodeArchive')(function* ({
  settings,
  commit,
  folder,
}: StageNodeInput): Effect.fn.Return<ReadonlyArray<Artifact>, DistributionFailed> {
  const entries = yield* Effect.tryPromise({
    try: () => readdir(NODE_OUTPUT_FOLDER, { recursive: true, withFileTypes: true }),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Read, reason: String(cause) }),
  });

  for (const entry of entries) {
    const source = join(entry.parentPath, entry.name);
    const path = relative(NODE_OUTPUT_FOLDER, source);

    if (!isSafeArtifactPath({ path }) || (!entry.isFile() && !entry.isDirectory())) {
      return yield* new DistributionFailed({
        step: DistributionStep.Verify,
        reason: `Node build contains an unsafe path or non-regular entry: ${path}`,
      });
    }
  }

  const build = yield* readDocument({ path: join(NODE_OUTPUT_FOLDER, 'release.json'), schema: NodeBuild });

  if (build.version !== RELEASE || build.revision !== commit) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'Node output belongs to another release or source revision; rebuild before packaging',
    });
  }

  const toolConfiguration = yield* Effect.tryPromise({
    try: () => readFile(join(SOURCE_FOLDER, 'mise.toml'), 'utf8'),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Read, reason: String(cause) }),
  });

  const nodeVersion = /^node = "(\d+\.\d+\.\d+)"$/m.exec(toolConfiguration)?.[1];

  if (nodeVersion === undefined) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'The source must pin one exact Node version',
    });
  }

  yield* Effect.tryPromise({
    try: () => cp(NODE_OUTPUT_FOLDER, folder, { recursive: true, errorOnExist: true, force: false }),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) }),
  });

  for (const name of ARTIFACT_NOTICE_NAMES) {
    const source = join(SOURCE_FOLDER, name);
    const destination = join(folder, name);

    yield* Effect.tryPromise({
      try: () => copyFile(source, destination, constants.COPYFILE_EXCL),
      catch: (cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) }),
    });
  }

  const outputPaths = entries
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const source = join(entry.parentPath, entry.name);

      return relative(NODE_OUTPUT_FOLDER, source);
    });

  const paths = [...outputPaths, ...ARTIFACT_NOTICE_NAMES];
  const files = yield* Effect.forEach(paths, (path) => nodeFileDigest({ folder, path }), { concurrency: 1 });

  if (!NODE_REQUIRED_FILES.every((path) => files.some((file) => file.path === path))) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'Node build is missing a runtime, migration, workflow, console, or notice entry',
    });
  }

  const inventory: NodeInventory = {
    format_version: FORMAT_VERSION,
    version: RELEASE,
    public_commit: commit,
    node_version: nodeVersion,
    files: files.toSorted((left, right) => left.path.localeCompare(right.path)),
  };

  yield* writeDocument({ path: join(folder, NODE_INVENTORY_FILE), document: inventory });

  const name = assetName({ kind: 'node' });
  const path = join(settings.folder, name);

  yield* runCommand({ command: 'tar', args: ['-czf', path, '-C', folder, '.'], settings });

  const digest = yield* fileDigest({ path });

  const release: NodeRelease = {
    format_version: FORMAT_VERSION,
    version: RELEASE,
    repository: RELEASE_REPOSITORY,
    public_commit: commit,
    runtime: {
      archive: name,
      ...digest,
      revision: commit,
      entrypoint: NODE_ENTRYPOINT,
      migrationEntrypoint: NODE_MIGRATION_ENTRYPOINT,
      workflowMigrationEntrypoint: WORKFLOW_MIGRATION_ENTRYPOINT,
      grantEntrypoint: NODE_GRANT_ENTRYPOINT,
      nodeVersion,
    },
  };

  const releasePath = join(settings.folder, 'release.json');

  yield* writeDocument({ path: releasePath, document: release });

  const releaseDigest = yield* fileDigest({ path: releasePath });

  return [
    { name, ...digest },
    { name: 'release.json', ...releaseDigest },
  ];
});

const nodeFileDigest = Effect.fn('nodeFileDigest')(function* ({
  folder,
  path,
}: NodeFileInput): Effect.fn.Return<NodeInventory['files'][number], DistributionFailed> {
  const source = join(folder, path);
  const digest = yield* fileDigest({ path: source });

  return { path, ...digest };
});
