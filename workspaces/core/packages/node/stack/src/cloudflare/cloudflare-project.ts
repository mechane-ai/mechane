import { SandboxProvider } from '@mechane/deployment';
import { workerRevision } from '@mechane/program';
import { baseConfiguration, WORKER_BUNDLE } from '@mechane/wrangler';
import { Effect } from 'effect';
import { readFile } from 'node:fs/promises';
import { StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import type { Stack, StackSettings, StackVariables } from '../types.ts';
import { tensorlakeFixture } from './tensorlake-fixture.ts';
import type { CloudflareOptionsInput } from './types.ts';

type CloudflareServices = {
  readonly served: Pick<Stack, 'githubOrigin' | 'modelUpstream'>;
  readonly variables: StackVariables;
};

type CloudflareProjectInput = {
  readonly settings: StackSettings;
  readonly origin: URL;
  readonly stateFolder: string;
  readonly services: CloudflareServices;
};

type CloudflareProject = { readonly revision: string; readonly context: CloudflareOptionsInput };

/** Loads the bundle and public configuration once; restarts preserve the same local provider and storage. */
export const cloudflareProject = Effect.fn('cloudflareProject')(function* ({
  settings,
  services,
  origin,
  stateFolder,
}: CloudflareProjectInput): Effect.fn.Return<CloudflareProject, StackFailed> {
  const base = yield* baseConfiguration({ step: StackStep.ReadWranglerConfiguration, failure: StackFailed });

  const revision = yield* workerRevision({
    environment: settings.inherited,
    step: StackStep.ReadWorkerRevision,
    failure: StackFailed,
  });

  const contents = yield* Effect.tryPromise({
    try: () => readFile(WORKER_BUNDLE, 'utf8'),
    catch: (cause) => new StackFailed({ step: StackStep.CopyWorkerBundle, reason: String(cause) }),
  });

  const variables = {
    ...services.variables,
    origin: origin.origin,
    workerRevision: revision,
    sandboxProvider: SandboxProvider.Tensorlake,
    tensorlakeApiKey: 'offline-provider-key',
    tensorlakeImage: 'fixture-next-image',
    approvalPollIntervalSeconds: '0',
  };

  const provider = tensorlakeFixture();
  const origins = new Set([services.served.githubOrigin.origin, services.served.modelUpstream.upstream.origin]);

  return { revision, context: { base, variables, origin, contents, stateFolder, origins, provider } };
});
