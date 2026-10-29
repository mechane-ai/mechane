import { LocalSandboxProvider } from '@mechane/deployment';
import { workerRevision } from '@mechane/program';
import { releasesBucket } from '@mechane/wrangler';
import { Duration, Effect } from 'effect';
import type { Scope } from 'effect';
import { startCelld } from './celld/start-celld.ts';
import { StackStep } from './constants.ts';
import { StackFailed } from './errors.ts';
import { stageProject } from './project/stage-project.ts';
import { publishRelease } from './releases/publish-release.ts';
import type { RuntimeStack, StackSettings, StackVariables, StateLayout } from './types.ts';

const STARTUP_TIMEOUT = {
  [LocalSandboxProvider.Host]: Duration.seconds(90),
  [LocalSandboxProvider.Container]: Duration.minutes(10),
} as const;

type StartRuntimeInput = {
  readonly settings: StackSettings;
  readonly layout: StateLayout;
  readonly origin: URL;
  readonly variables: StackVariables;
  readonly sandboxProvider: LocalSandboxProvider;
  readonly isPersistent: boolean;
};

/** Stages and starts the production Worker on the caller’s state, origin, and deployment variables. */
export const startRuntime = Effect.fn('startRuntime')(function* ({
  settings,
  layout,
  origin,
  variables,
  sandboxProvider,
  isPersistent,
}: StartRuntimeInput): Effect.fn.Return<RuntimeStack, StackFailed, Scope.Scope> {
  const { projectFolder, logFile } = layout;

  const revision = yield* workerRevision({
    environment: settings.inherited,
    step: StackStep.ReadWorkerRevision,
    failure: StackFailed,
  });

  const staged = { ...variables, workerRevision: revision, origin: origin.origin };
  const { durableObjectClasses } = yield* stageProject({ projectFolder, variables: staged, sandboxProvider });
  const startupTimeout = STARTUP_TIMEOUT[sandboxProvider];
  const celld = yield* startCelld({ projectFolder, origin, logFile, settings, startupTimeout, staged, isPersistent });
  const bucket = yield* releasesBucket({ step: StackStep.FindReleasesBucket, failure: StackFailed });

  return {
    origin,
    ...layout,
    ...celld,
    settings,
    workerRevision: revision,
    durableObjectClasses,
    publish: ({ folder }) => publishRelease({ projectFolder, bucket, folder }),
  };
});
