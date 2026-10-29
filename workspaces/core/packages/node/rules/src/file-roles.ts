import { FileRole } from '@mechane/rule-shapes';

/** The files of each role, as paths or globs relative to the workspace, which the configurations treat apart. */
export const FILE_ROLES = {
  [FileRole.Settings]: [
    'packages/node/cli/src/settings/load-invocation.ts',
    'packages/node/guest/src/load-guest-settings.ts',
    'packages/node/stack/src/load-stack-settings.ts',
    'packages/node/release/src/load-release-settings.ts',
    'packages/node/deploy/src/load-deploy-settings.ts',
    'packages/node/deploy/src/image/load-image-settings.ts',
    'packages/node/checks/src/load-checks-settings.ts',
    'packages/node/rename/src/load-rename-settings.ts',
    'packages/node/package-moves/src/load-move-settings.ts',
    'packages/node/rule-generator/src/load-generate-settings.ts',
  ],
  [FileRole.Output]: [
    'packages/node/cli/scripts/reference/main.ts',
    'packages/node/program/src/output/**',
    'packages/node/testing/src/check.ts',
    'packages/worker/logs/src/write-log.ts',
  ],
  [FileRole.WorkerModule]: ['packages/worker/app/src/worker.ts'],
  [FileRole.CelldRestart]: ['packages/node/stack/src/celld/start-celld.ts'],
  [FileRole.EntryPoint]: ['packages/**/src/index.ts'],
  [FileRole.Catalog]: ['packages/node/smoke/src/catalog.ts'],
  [FileRole.ObjectClass]: [
    'packages/worker/directory/src/directory-object.ts',
    'packages/worker/key-cache/src/key-cache-object.ts',
    'packages/worker/limiter/src/limiter-object.ts',
    'packages/worker/mech/src/mech-object.ts',
    'packages/worker/sandbox/src/sandbox-object.ts',
    'packages/worker/workspace/src/workspace-object.ts',
  ],
  [FileRole.Migrations]: ['**/migrations.ts'],
  [FileRole.CruiserConfiguration]: ['.dependency-cruiser.cjs'],
  [FileRole.Utilities]: ['**/utilities/**'],
  [FileRole.Constants]: ['**/constants.ts'],
} as const satisfies Readonly<Record<FileRole, ReadonlyArray<string>>>;
