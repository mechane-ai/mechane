import { LocalSandboxProvider, SandboxEgress } from '@mechane/deployment';
import { Duration, Effect } from 'effect';
import type { Scope } from 'effect';
import { startCelld } from './celld/start-celld.ts';
import type { StackFailed } from './errors.ts';
import { stageProject } from './project/stage-project.ts';
import { publishRelease } from './releases/publish-release.ts';
import type { RuntimeProject, RuntimeStack, StackSettings, StackVariables, StateLayout } from './types.ts';

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
  readonly project: RuntimeProject;
};

/** Stages and starts the production Worker on the caller’s state, origin, and deployment variables. */
export const startRuntime = Effect.fn('startRuntime')(function* ({
  settings,
  layout,
  origin,
  variables,
  sandboxProvider,
  isPersistent,
  project,
}: StartRuntimeInput): Effect.fn.Return<RuntimeStack, StackFailed, Scope.Scope> {
  const { projectFolder, logFile } = layout;
  const { revision, celldCommand, releasesBucket: bucket } = project;

  const staged = { ...variables, workerRevision: revision, origin: origin.origin, sandboxEgress: SandboxEgress.Fence };
  const { durableObjectClasses } = yield* stageProject({ projectFolder, variables: staged, sandboxProvider, project });
  const startupTimeout = STARTUP_TIMEOUT[sandboxProvider];
  const launch = { projectFolder, origin, logFile, settings, startupTimeout, staged, isPersistent, celldCommand };
  const celld = yield* startCelld(launch);

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
