import { DeployFailed, DeployStep, productionVariables } from '@mechane/deploy-kernel';
import type { RenderedConfiguration, SettingsInput } from '@mechane/deploy-kernel';
import { workerRevision } from '@mechane/program';
import { baseConfiguration, withBuiltBundle, WORKER_BUNDLE } from '@mechane/wrangler';
import { Effect, Struct } from 'effect';
import { renderContainers } from './render-containers.ts';
import { renderVariables } from './render-variables.ts';
import { writeRendered } from './write-rendered.ts';

/** Combines installation resources with this release's bundle, guest image, stable bindings and migrations. */
export const renderConfiguration = Effect.fn('renderConfiguration')(function* ({
  settings,
}: SettingsInput): Effect.fn.Return<RenderedConfiguration, DeployFailed> {
  const base = yield* baseConfiguration({ step: DeployStep.ReadWranglerConfiguration, failure: DeployFailed });
  const overlay = settings.installation;

  const revision = yield* workerRevision({
    environment: settings.inherited,
    step: DeployStep.ReadWorkerRevision,
    failure: DeployFailed,
  });

  const variables = renderVariables({ base, settings, revision });
  const containers = yield* renderContainers({ settings, base });
  const resources = Struct.omit(overlay, ['vars', 'container', 'tensorlake_image_prefix', 'secret_refs']);

  const rendered = withBuiltBundle({
    configuration: { ...base, ...resources, vars: variables, containers },
    main: WORKER_BUNDLE,
  });

  const summary = {
    name: overlay.name,
    revision,
    variables,
    migrations: base.migrations,
    releasesBucket: overlay.r2_buckets[0].bucket_name,
    workspaceBucket: overlay.r2_buckets[1].bucket_name,
  };

  yield* productionVariables({ rendered: summary });

  const configurationPath = yield* writeRendered({ configuration: rendered });

  return { ...summary, configurationPath };
});
