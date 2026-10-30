import { Effect, Exit, Ref, Scope } from 'effect';
import type { Duration } from 'effect';
import type { ChildProcess } from 'node:child_process';
import type { StackFailed } from '../errors.ts';
import { stopProcessGroup } from '../processes/stop-process-group.ts';
import { stageVariables } from '../project/stage-variables.ts';
import type { RestartInput, StackSettings, StackVariables } from '../types.ts';
import { awaitReady } from './await-ready.ts';
import { celldProcessGroups } from './celld-process-groups.ts';
import { killCelld } from './kill-celld.ts';
import { releaseCelldOwner } from './release-celld-owner.ts';
import { spawnOwnedCelld } from './spawn-owned-celld.ts';
import { writeCelldOwner } from './write-celld-owner.ts';

type CelldProcessInput = {
  readonly projectFolder: string;
  readonly origin: URL;
  readonly logFile: string;
  readonly settings: StackSettings;
  /** How long celld may take to serve the Worker. */
  readonly startupTimeout: Duration.Duration;
  readonly isPersistent: boolean;
  readonly celldCommand: string;
};

/** A celld process to start, and the variables the stack staged, over which a restart stages its own. */
type StartCelldInput = CelldProcessInput & { readonly staged: StackVariables };

/** A celld that serves the stack until its scope closes, and that a scenario can crash and start again. */
type RunningCelld = { readonly restart: (input: RestartInput) => Effect.Effect<void, StackFailed> };

/**
 * Starts `celld dev` on the staged project and waits until it serves the Worker. A restart kills celld and its runtime,
 * as a crash of the host would, and stages the project's variables again with the restart's over the staged ones. It
 * then starts celld again on the same project, port and log, in the same scope.
 */
export const startCelld = Effect.fn('startCelld')(function* ({
  projectFolder,
  origin,
  logFile,
  settings,
  startupTimeout,
  staged,
  isPersistent,
  celldCommand,
}: StartCelldInput): Effect.fn.Return<RunningCelld, StackFailed, Scope.Scope> {
  const started = celldProcess({
    projectFolder,
    origin,
    logFile,
    settings,
    startupTimeout,
    isPersistent,
    celldCommand,
  });

  const scope = yield* Effect.scope;
  const current = yield* Ref.make(yield* started);

  const restart = Effect.fn('restart')(function* ({ variables }: RestartInput): Effect.fn.Return<void, StackFailed> {
    yield* killCelld({ child: yield* Ref.get(current) });
    yield* stageVariables({ projectFolder, variables: { ...staged, ...variables } });
    yield* Ref.set(current, yield* Scope.provide(scope)(started));
  });

  return { restart };
});

/**
 * Starts `celld dev` in its own process group and waits until it serves the Worker; closing the scope stops the group.
 * A passing disposable run kills it at once. Persistent runs stop with SIGTERM so their logs and databases end whole.
 */
const celldProcess = Effect.fn('celldProcess')(function* ({
  projectFolder,
  origin,
  logFile,
  settings,
  startupTimeout,
  isPersistent,
  celldCommand,
}: CelldProcessInput): Effect.fn.Return<ChildProcess, StackFailed, Scope.Scope> {
  const release: (child: ChildProcess, exit: Exit.Exit<unknown, unknown>) => Effect.Effect<void> = Effect.fn('release')(
    function* (child: ChildProcess, exit: Exit.Exit<unknown, unknown>): Effect.fn.Return<void> {
      // This named acquireRelease finalizer cannot recover from a failed kill of its owned process.
      const kill = killCelld({ child }).pipe(Effect.orDie);

      if (Exit.isSuccess(exit) && !isPersistent) {
        return yield* kill;
      }

      yield* stopProcessGroup({ child, kill });

      if (isPersistent) {
        yield* releaseCelldOwner({ projectFolder, child }).pipe(Effect.orDie);
      }
    },
  );

  const launch = { projectFolder, origin, settings, logFile, isPersistent, celldCommand };
  const child = yield* Effect.acquireRelease(spawnOwnedCelld(launch), release);

  yield* awaitReady({ origin, child, logFile, startupTimeout });

  if (isPersistent) {
    const processGroups = yield* celldProcessGroups({ child });

    yield* writeCelldOwner({ projectFolder, owner: { processGroups, isReady: true } });
  }

  return child;
});
