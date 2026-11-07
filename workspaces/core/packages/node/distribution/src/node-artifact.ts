import { ArtifactDigest } from '@mechane/program';
import { Release, RELEASE_REPOSITORY } from '@mechane/protocol';
import { GitCommit } from '@mechane/records';
import { Schema } from 'effect';
import { fileURLToPath } from 'node:url';
import { ARTIFACT_NOTICE_NAMES, ASSET_PATTERN, FORMAT_VERSION } from './constants.ts';

const NODE_OUTPUT_URL: Readonly<URL> = new URL('../../server/.output/', import.meta.url);
const FORBIDDEN_PATH_PARTS: ReadonlySet<string> = new Set(['', '.', '..']);

/** Distribution copies only the compiler's complete output tree. */
export const NODE_OUTPUT_FOLDER = fileURLToPath(NODE_OUTPUT_URL);
/** The verifier reads this inventory after rejecting unsafe archive entries. */
export const NODE_INVENTORY_FILE = 'runtime.json';
/** The deployment starts this compiled HTTP process. */
export const NODE_ENTRYPOINT = 'server.mjs';
/** Domain migrations run under the installation's separate migrator role. */
export const NODE_MIGRATION_ENTRYPOINT = 'migrate.mjs';
/** The upstream bootstrap CLI keeps its relative SQL resources in the archive. */
export const WORKFLOW_MIGRATION_ENTRYPOINT = 'workflow/bootstrap/dist/cli.mjs';
/** The product grants the runtime role access after both schemas have migrated. */
export const NODE_GRANT_ENTRYPOINT = 'grant.mjs';

/** Missing executable, workflow, or console entries stop publication. */
export const NODE_REQUIRED_FILES = [
  NODE_ENTRYPOINT,
  NODE_MIGRATION_ENTRYPOINT,
  WORKFLOW_MIGRATION_ENTRYPOINT,
  NODE_GRANT_ENTRYPOINT,
  'release.json',
  'workflow/flow.mjs',
  'workflow/manifest.json',
  'public/console/index.html',
  'public/console/THIRD_PARTY_LICENSES.txt',
  'THIRD_PARTY_LICENSES.txt',
  ...ARTIFACT_NOTICE_NAMES,
] as const;

/** The compiler records source identity beside the executable it produced. */
export const NodeBuild = Schema.Struct({ version: Release, revision: GitCommit });

/** The complete regular-file inventory inside an immutable Node release. */
export const NodeInventory = Schema.Struct({
  format_version: Schema.Literal(FORMAT_VERSION),
  version: Release,
  public_commit: GitCommit,
  node_version: Schema.String.check(Schema.isPattern(/^\d+\.\d+\.\d+$/)),
  files: Schema.Array(
    Schema.Struct({
      path: Schema.String.check(Schema.isPattern(/^[A-Za-z0-9@._+/-]+$/)),
      sha256: ArtifactDigest.fields.sha256,
      bytes: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    }),
  ),
});

export type NodeInventory = typeof NodeInventory.Type;

/** The deployment consumes this descriptor without compiling or installing application dependencies. */
export const NodeRelease = Schema.Struct({
  format_version: Schema.Literal(FORMAT_VERSION),
  version: Release,
  repository: Schema.Literal(RELEASE_REPOSITORY),
  public_commit: GitCommit,
  runtime: Schema.Struct({
    archive: Schema.String.check(Schema.isPattern(ASSET_PATTERN)),
    ...ArtifactDigest.fields,
    revision: GitCommit,
    entrypoint: Schema.Literal(NODE_ENTRYPOINT),
    migrationEntrypoint: Schema.Literal(NODE_MIGRATION_ENTRYPOINT),
    workflowMigrationEntrypoint: Schema.Literal(WORKFLOW_MIGRATION_ENTRYPOINT),
    grantEntrypoint: Schema.Literal(NODE_GRANT_ENTRYPOINT),
    nodeVersion: Schema.String.check(Schema.isPattern(/^\d+\.\d+\.\d+$/)),
  }),
});

export type NodeRelease = typeof NodeRelease.Type;
type ArtifactPathInput = { readonly path: string };

/** Archive members are portable relative paths, without links or parent traversal. */
export function isSafeArtifactPath({ path }: ArtifactPathInput): boolean {
  return /^[A-Za-z0-9@._+/-]+$/.test(path) && path.split('/').every((part) => !FORBIDDEN_PATH_PARTS.has(part));
}
