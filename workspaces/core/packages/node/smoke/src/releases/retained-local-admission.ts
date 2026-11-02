import { ReleaseDescriptor, sha256Hex, startProcess, SUCCESS_STATUS } from '@mechane/program';
import { check, FileStep, FileStepFailed, freshFolder } from '@mechane/testing';
import type { ScenarioFailure, ScenarioInput } from '@mechane/testing';
import { Duration, Effect, Option, Schema } from 'effect';
import type { Scope } from 'effect';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const CORE_FOLDER = join(import.meta.dirname, '..', '..', '..', '..', '..');
const LAUNCHER = join(CORE_FOLDER, 'packages', 'node', 'stack', 'src', 'main.ts');
const WORKER = join(CORE_FOLDER, 'packages', 'worker', 'app', 'dist', 'worker.js');
const MODEL_EXAMPLE = join(CORE_FOLDER, 'packages', 'node', 'stack', 'model.example.json');
const FUTURE_RELEASE = '999999.0.0';
const LAUNCH_TIMEOUT = Duration.seconds(30);
const PRIVATE_MODE = 0o600;
const UNVERSIONED_APPLICATION = 'mechane';
const PRESERVED_CONTENTS = 'keep this data';

const StateReceipt = Schema.Struct({ application: Schema.String, origin: Schema.String, release: ReleaseDescriptor });
type StateReceipt = typeof StateReceipt.Type;
type FixtureFile = { readonly path: string };
type FixtureWrite = FixtureFile & { readonly contents: string };

type LaunchInput = ScenarioInput & {
  readonly folder: string;
  /** Absent to exercise admission without an operator-supplied previous manifest. */
  readonly adoption: Option.Option<string>;
};

/** The real source launcher admits a release, then stops before runtime startup at the occupied fixture origin. */
export const retainedLocalAdmission = Effect.fn('retainedLocalAdmission')(function* ({
  stack,
  guarantee,
}: ScenarioInput): Effect.fn.Return<void, ScenarioFailure> {
  const folder = yield* freshFolder({ stack, prefix: 'retained-admission-' });
  const path = join(folder, 'local-state.json');
  const sentinel = join(folder, 'preserved-data');
  const noAdoption = Option.none<string>();
  const input = { stack, guarantee, folder, adoption: noAdoption };

  const first = yield* refusedLaunch(input);
  const original = yield* readFixture({ path });
  const codec = Schema.fromJsonString(StateReceipt);

  const receipt = yield* Schema.decodeUnknownEffect(codec)(original).pipe(
    Effect.mapError(
      () => new FileStepFailed({ step: FileStep.Read, path, reason: 'launcher did not write a valid release receipt' }),
    ),
  );

  yield* writeFixture({ path: sentinel, contents: PRESERVED_CONTENTS });

  const future: StateReceipt = { ...receipt, release: { ...receipt.release, version: FUTURE_RELEASE } };
  const futureText = JSON.stringify(future);

  yield* writeFixture({ path, contents: futureText });

  const older = yield* refusedLaunch(input);
  const afterOlder = yield* readFixture({ path });

  const removed: StateReceipt = {
    ...receipt,
    release: {
      ...receipt.release,
      formats: { ...receipt.release.formats, wire: { ...receipt.release.formats.wire, future_category: [] } },
    },
  };

  const removedText = JSON.stringify(removed);

  yield* writeFixture({ path, contents: removedText });

  const incompatible = yield* refusedLaunch(input);
  const afterIncompatible = yield* readFixture({ path });

  const project = join(folder, 'project');
  const stagedWorker = join(project, 'worker.js');
  const unversionedText = JSON.stringify({ application: UNVERSIONED_APPLICATION, origin: receipt.origin });

  yield* writeFixture({ path, contents: unversionedText });
  yield* Effect.tryPromise({
    try: () => mkdir(project, { recursive: true }),
    catch: (cause) => new FileStepFailed({ step: FileStep.Create, path: project, reason: String(cause) }),
  });

  const workerText = yield* readFixture({ path: WORKER });
  const previousWorker = `${workerText}\n`;

  yield* writeFixture({ path: stagedWorker, contents: previousWorker });

  const noBaseline = yield* refusedLaunch(input);
  const baselinePath = join(folder, 'installation.json');
  const baselineText = JSON.stringify(receipt.release);

  yield* writeFixture({ path: baselinePath, contents: baselineText });

  const adoption = Option.some(baselinePath);
  const mismatched = yield* refusedLaunch({ ...input, adoption });
  const afterMismatch = yield* readFixture({ path });

  const sha256 = sha256Hex({ contents: previousWorker });
  const bytes = Buffer.byteLength(previousWorker);
  const matchingText = JSON.stringify({ ...receipt.release, worker: { sha256, bytes } });

  yield* writeFixture({ path: baselinePath, contents: matchingText });

  const verifiedAdoption = yield* refusedLaunch({ ...input, adoption });
  const afterVerifiedAdoption = yield* readFixture({ path });

  yield* writeFixture({ path, contents: unversionedText });

  yield* Effect.tryPromise({
    try: () => copyFile(WORKER, stagedWorker),
    catch: (cause) => new FileStepFailed({ step: FileStep.Write, path: stagedWorker, reason: String(cause) }),
  });

  const adopted = yield* refusedLaunch(input);
  const afterAdoption = yield* readFixture({ path });
  const kept = yield* readFixture({ path: sentinel });

  const conditions = [
    first.includes('EADDRINUSE'),
    older.includes('downgrades are not supported'),
    afterOlder === futureText,
    incompatible.includes('removes or changes recorded wire'),
    afterIncompatible === removedText,
    noBaseline.includes('MECHANE_LOCAL_ADOPTION_MANIFEST'),
    mismatched.includes('does not match the existing Worker bytes'),
    afterMismatch === unversionedText,
    verifiedAdoption.includes('EADDRINUSE'),
    afterVerifiedAdoption === original,
    adopted.includes('EADDRINUSE'),
    afterAdoption === original,
    kept === PRESERVED_CONTENTS,
  ];

  yield* check({
    name: guarantee,
    conditions,
    detail: `fresh: ${first}; downgrade: ${older}; formats: ${incompatible}; missing baseline: ${noBaseline}; mismatch: ${mismatched}; adoption: ${adopted}`,
  });
}, Effect.scoped);

const refusedLaunch = Effect.fn('refusedLaunch')(function* ({
  stack,
  folder,
  adoption,
  guarantee,
}: LaunchInput): Effect.fn.Return<string, ScenarioFailure, Scope.Scope> {
  const environment: Record<string, string> = {
    ...stack.settings.inherited,
    MECHANE_LOCAL_STATE_DIR: folder,
    MECHANE_LOCAL_ORIGIN: stack.origin.origin,
  };

  if (Option.isSome(adoption)) {
    environment['MECHANE_LOCAL_ADOPTION_MANIFEST'] = adoption.value;
  }

  const process = yield* startProcess({
    command: 'node',
    args: [LAUNCHER, 'start', '--config', MODEL_EXAMPLE],
    environment,
    timeout: LAUNCH_TIMEOUT,
  });

  const run = yield* process.exited;
  const succeeded = Option.contains(run.status, SUCCESS_STATUS);

  yield* check({
    name: guarantee,
    conditions: [!succeeded],
    detail: 'the launcher unexpectedly opened retained state',
  });

  return run.stderr;
}, Effect.scoped);

const readFixture = Effect.fn('readFixture')(function* ({
  path,
}: FixtureFile): Effect.fn.Return<string, FileStepFailed> {
  return yield* Effect.tryPromise({
    try: () => readFile(path, 'utf8'),
    catch: (cause) => new FileStepFailed({ step: FileStep.Read, path, reason: String(cause) }),
  });
});

const writeFixture = Effect.fn('writeFixture')(function* ({
  path,
  contents,
}: FixtureWrite): Effect.fn.Return<void, FileStepFailed> {
  yield* Effect.tryPromise({
    try: () => writeFile(path, contents, { mode: PRIVATE_MODE }),
    catch: (cause) => new FileStepFailed({ step: FileStep.Write, path, reason: String(cause) }),
  });
});
