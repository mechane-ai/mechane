import { WORKER_BUNDLE } from '@mechane/wrangler';
import type { BaseConfiguration } from '@mechane/wrangler';
import { Effect, Record, Schema } from 'effect';
import { DistributionStep, DURABLE_EXPORT, WORKER_FILENAME } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { fileDigest } from '../files/file-digest.ts';
import { InstallationManifest } from '../schemas.ts';

type WorkerInput = { readonly base: BaseConfiguration };

const WorkerConfiguration = Schema.Struct({
  compatibility_date: Schema.String,
  compatibility_flags: Schema.Array(Schema.String),
  durable_objects: Schema.Struct({ bindings: InstallationManifest.fields.worker.fields.bindings }),
});

/** Derives durable exports and compatibility settings from the configuration that also runs locally. */
export const workerManifest = Effect.fn('workerManifest')(function* ({
  base,
}: WorkerInput): Effect.fn.Return<InstallationManifest['worker'], DistributionFailed> {
  const failed: (cause: unknown) => DistributionFailed = (cause) => {
    const reason = String(cause);

    return new DistributionFailed({ step: DistributionStep.Read, reason });
  };

  const configuration = yield* Schema.decodeUnknownEffect(WorkerConfiguration)(base).pipe(Effect.mapError(failed));
  const checksum = yield* fileDigest({ path: WORKER_BUNDLE });
  const bindings = configuration.durable_objects.bindings;
  const exports = bindings.map((binding) => [binding.class_name, DURABLE_EXPORT] as const);

  return {
    path: WORKER_FILENAME,
    ...checksum,
    compatibility_date: configuration.compatibility_date,
    compatibility_flags: configuration.compatibility_flags,
    bindings,
    exports: Record.fromEntries(exports),
    migrations: base.migrations,
  };
});
