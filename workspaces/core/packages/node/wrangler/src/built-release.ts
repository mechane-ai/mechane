import {
  artifactDigest,
  ArtifactDigest,
  finishedProcess,
  jsonFileText,
  PrivateMode,
  readReleaseDescriptor,
  ReleaseDescriptor,
  replaceFile,
  StepSubjects,
} from '@mechane/program';
import { RELEASE } from '@mechane/protocol';
import { Duration, Effect, Option, Schema } from 'effect';
import type { Scope } from 'effect';
import { fileURLToPath } from 'node:url';
import { baseConfiguration } from './base-configuration.ts';
import { writeConsoleBundle } from './console.ts';
import { CONSOLE_BUNDLE, WORKER_BUNDLE } from './constants.ts';
import { readJsonc } from './read-jsonc.ts';
import { BaseConfiguration } from './schemas.ts';

const CORE_URL: Readonly<URL> = new URL('../../../../', import.meta.url);
const DESCRIPTOR_URL: Readonly<URL> = new URL('../../../worker/app/dist/release.json', import.meta.url);
const CORE_FOLDER = fileURLToPath(CORE_URL);
const DESCRIPTOR_FILE = fileURLToPath(DESCRIPTOR_URL);
const COMMIT_TIMEOUT = Duration.seconds(10);
const BuildStep = { Read: 'read Worker build metadata', Write: 'record Worker build metadata' } as const;

/** Build metadata keeps source-mode configuration paired with its compiled Worker and format locks. */
export const BuiltRelease = Schema.Struct({
  ...ReleaseDescriptor.fields,
  configuration: BaseConfiguration,
  console: ArtifactDigest,
});

export type BuiltRelease = typeof BuiltRelease.Type;

class WorkerBuildFailed extends Schema.TaggedError<WorkerBuildFailed>()('WorkerBuildFailed', {
  step: Schema.Enum(BuildStep),
  subjects: StepSubjects,
  reason: Schema.String,
}) {}

/** Runs after bundling and binds the complete format baseline to those exact Worker bytes. */
export const writeBuiltRelease = Effect.fn('writeBuiltRelease')(function* (): Effect.fn.Return<
  void,
  WorkerBuildFailed,
  Scope.Scope
> {
  const committed = yield* finishedProcess({
    command: 'git',
    args: ['-C', CORE_FOLDER, 'rev-parse', 'HEAD'],
    environment: {},
    timeout: COMMIT_TIMEOUT,
  }).pipe(Effect.mapError((failure) => new WorkerBuildFailed({ step: BuildStep.Read, reason: failure.reason })));

  const commit = committed.stdout.trim();

  const worker = yield* artifactDigest({ path: WORKER_BUNDLE }).pipe(
    Effect.mapError((failure) => new WorkerBuildFailed({ step: BuildStep.Read, reason: failure.reason })),
  );

  const descriptor = yield* readReleaseDescriptor({ root: CORE_FOLDER, version: RELEASE, commit, worker }).pipe(
    Effect.mapError((failure) => new WorkerBuildFailed({ step: BuildStep.Read, reason: failure.reason })),
  );

  const configuration = yield* baseConfiguration({ step: BuildStep.Read, failure: WorkerBuildFailed });

  yield* writeConsoleBundle().pipe(
    Effect.mapError((failure) => new WorkerBuildFailed({ step: BuildStep.Write, reason: failure.reason })),
  );

  const console = yield* artifactDigest({ path: CONSOLE_BUNDLE }).pipe(
    Effect.mapError((failure) => new WorkerBuildFailed({ step: BuildStep.Read, reason: failure.reason })),
  );

  const value = { ...descriptor, configuration, console };
  const contents = jsonFileText({ schema: BuiltRelease, value });
  const accept = Option.none();

  yield* replaceFile({ path: DESCRIPTOR_FILE, contents, mode: PrivateMode.File, accept }).pipe(
    Effect.mapError((failure) => new WorkerBuildFailed({ step: BuildStep.Write, reason: failure.reason })),
  );
}, Effect.scoped);

/** Refuses a missing or stale build descriptor before source startup or artifact packaging. */
export const readBuiltRelease = Effect.fn('readBuiltRelease')(function* (): Effect.fn.Return<
  BuiltRelease,
  WorkerBuildFailed
> {
  const descriptor = yield* readJsonc({
    path: DESCRIPTOR_FILE,
    schema: BuiltRelease,
    options: { onExcessProperty: 'error' },
    step: BuildStep.Read,
    failure: WorkerBuildFailed,
  });

  const worker = yield* artifactDigest({ path: WORKER_BUNDLE }).pipe(
    Effect.mapError((failure) => new WorkerBuildFailed({ step: BuildStep.Read, reason: failure.reason })),
  );

  if (worker.sha256 !== descriptor.worker.sha256 || worker.bytes !== descriptor.worker.bytes) {
    return yield* new WorkerBuildFailed({
      step: BuildStep.Read,
      reason:
        'Worker bytes differ from their build descriptor; run mise run build:worker before starting or packaging this release',
    });
  }

  const console = yield* artifactDigest({ path: CONSOLE_BUNDLE }).pipe(
    Effect.mapError((failure) => new WorkerBuildFailed({ step: BuildStep.Read, reason: failure.reason })),
  );

  if (console.sha256 !== descriptor.console.sha256 || console.bytes !== descriptor.console.bytes) {
    return yield* new WorkerBuildFailed({
      step: BuildStep.Read,
      reason: 'Console assets differ from their build descriptor; run mise run build:worker',
    });
  }

  return descriptor;
});
