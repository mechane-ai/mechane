import { LocalSandboxProvider } from '@mechane/deployment';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import type { StackFailed } from '../errors.ts';
import { freeLoopbackOrigin } from '../loopback/free-loopback-origin.ts';
import { localServices } from '../services/local-services.ts';
import { freshStateFolder } from '../state/fresh-state-folder.ts';
import type { Stack, StackSettings } from '../types.ts';
import { cloudflareOptions } from './cloudflare-options.ts';
import { cloudflareProject } from './cloudflare-project.ts';
import { openCloudflareRuntime } from './open-cloudflare-runtime.ts';
import { publishCloudflareRelease } from './publish-cloudflare-release.ts';
import { restartCloudflare } from './restart-cloudflare.ts';

type StartCloudflareStackInput = { readonly settings: StackSettings };

/** A second runtime in the same offline smoke, using the built Worker and normal browser/CLI authentication. */
export const startCloudflareStack = Effect.fn('startCloudflareStack')(function* ({
  settings,
}: StartCloudflareStackInput): Effect.fn.Return<Stack, StackFailed, Scope.Scope> {
  const layout = yield* freshStateFolder({ stateRoot: settings.stateRoot });
  const origin = yield* freeLoopbackOrigin();

  const services = yield* localServices({
    origin,
    settings,
    sandboxProvider: LocalSandboxProvider.Host,
    sandboxesFolder: layout.sandboxesFolder,
    variables: {},
  });

  const project = yield* cloudflareProject({ settings, services, origin, stateFolder: layout.stateFolder });
  const options = cloudflareOptions(project.context);
  const runtime = yield* openCloudflareRuntime({ options });

  return {
    ...layout,
    ...services.served,
    settings,
    origin,
    workerRevision: project.revision,
    durableObjectClasses: project.context.base.migrations.flatMap((migration) => migration.new_sqlite_classes),
    restart: ({ variables }) => restartCloudflare({ runtime, context: project.context, variables }),
    publish: ({ folder }) => publishCloudflareRelease({ runtime, folder }),
  };
});
