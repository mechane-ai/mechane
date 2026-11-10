import type { ArtifactDigest } from '@mechane/program';
import type { BaseConfiguration } from '@mechane/wrangler';
import { Effect, Record, Schema } from 'effect';
import { ASSETS_CONFIGURATION_KEY, DistributionStep, DURABLE_EXPORT, WORKER_FILENAME } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import type { RuntimeBuild, RuntimeInventory } from '../runtime-artifact.ts';
import { InstallationManifest } from '../schemas.ts';
import { consoleContentType } from './console-content-type.ts';

type WorkerInput = {
  readonly base: BaseConfiguration;
  readonly checksum: ArtifactDigest;
  readonly inventory: RuntimeInventory;
  readonly build: RuntimeBuild;
};

const WorkerConfiguration = Schema.Struct({
  compatibility_date: Schema.String,
  compatibility_flags: Schema.Array(Schema.String),
  triggers: InstallationManifest.fields.worker.fields.triggers,
  durable_objects: Schema.Struct({ bindings: InstallationManifest.fields.worker.fields.bindings }),
  assets: Schema.Struct({
    binding: InstallationManifest.fields.worker.fields.assets.fields.binding,
    ...InstallationManifest.fields.worker.fields.assets.fields[ASSETS_CONFIGURATION_KEY].fields,
  }),
});

/** Derives durable exports and compatibility settings from the configuration that also runs locally. */
export const workerManifest = Effect.fn('workerManifest')(function* ({
  base,
  checksum,
  inventory,
  build,
}: WorkerInput): Effect.fn.Return<InstallationManifest['worker'], DistributionFailed> {
  const failed: (cause: unknown) => DistributionFailed = (cause) => {
    const reason = String(cause);

    return new DistributionFailed({ step: DistributionStep.Read, reason });
  };

  const configuration = yield* Schema.decodeUnknownEffect(WorkerConfiguration)(base).pipe(Effect.mapError(failed));
  const bindings = configuration.durable_objects.bindings;
  const exports = bindings.map((binding) => [binding.class_name, DURABLE_EXPORT] as const);
  const modules: Array<InstallationManifest['worker']['modules'][number]> = [];

  for (const module of build.worker_modules) {
    const file = inventory.files.find((entry) => entry.path === module.path);

    if (file === undefined) {
      return yield* new DistributionFailed({
        step: DistributionStep.Verify,
        reason: `missing Worker module: ${module.path}`,
      });
    }

    modules.push({ ...file, content_type: module.content_type });
  }

  const assets = inventory.files
    .filter((file) => file.path.startsWith('console/'))
    .map((file) => ({
      ...file,
      path: file.path.slice('console/'.length),
      content_type: consoleContentType({ path: file.path }),
    }));

  return {
    path: WORKER_FILENAME,
    ...checksum,
    compatibility_date: configuration.compatibility_date,
    compatibility_flags: configuration.compatibility_flags,
    triggers: configuration.triggers,
    bindings,
    container_classes: base.containers.map((container) => container.class_name),
    exports: Record.fromEntries(exports),
    migrations: base.migrations,
    modules,
    assets: {
      directory: 'console',
      binding: configuration.assets.binding,
      files: assets,
      [ASSETS_CONFIGURATION_KEY]: {
        html_handling: configuration.assets.html_handling,
        not_found_handling: configuration.assets.not_found_handling,
        run_worker_first: configuration.assets.run_worker_first,
      },
    },
  };
});
