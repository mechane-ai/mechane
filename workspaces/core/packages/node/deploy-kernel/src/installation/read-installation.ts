import { readJsonc } from '@mechane/wrangler';
import { Effect, Schema } from 'effect';
import { DeployStep } from '../constants.ts';
import { DeployFailed } from '../errors.ts';
import { InstallationConfiguration } from '../installation.schemas.ts';
import type { InstallationOverlay } from '../installation.schemas.ts';

type ReadInstallationInput = { readonly path: string };

/** Rejects unrecognized variables and resource keys before any account is contacted. */
export const readInstallation = Effect.fn('readInstallation')(function* ({
  path,
}: ReadInstallationInput): Effect.fn.Return<InstallationOverlay, DeployFailed> {
  const options = { onExcessProperty: 'error' } as const;

  const decoded = yield* readJsonc({
    path,
    schema: InstallationConfiguration,
    options,
    step: DeployStep.ReadOverlay,
    failure: DeployFailed,
  }).pipe(
    Effect.mapError(
      ({ step, subjects }) =>
        new DeployFailed({
          step,
          subjects,
          reason:
            'invalid installation configuration; compare the public example and keep credential values in the referenced environment',
        }),
    ),
  );

  return Schema.encodeSync(InstallationConfiguration)(decoded);
});
