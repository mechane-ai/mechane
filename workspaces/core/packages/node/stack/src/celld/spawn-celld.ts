import { PrivateMode, StepSubject } from '@mechane/program';
import { Duration, Effect, Schema } from 'effect';
import type { Scope } from 'effect';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { open } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import { loopbackPort } from '../loopback/loopback-port.ts';
import type { StackSettings } from '../types.ts';

/**
 * How long celld lets one outbound request of the Worker last, as `CELLD_FETCH_TIMEOUT_S`: above a dispatch's
 * five-minute stream deadline, which pi owns, so celld never cuts a model's answer first.
 */
const CELLD_FETCH_TIMEOUT = Duration.seconds(330);

/** The handle of celld's log at `path` could not be closed once celld held its own descriptor of it. */
class LogUnclosed extends Schema.TaggedError<LogUnclosed>()('LogUnclosed', {
  path: Schema.String,
  reason: Schema.String,
}) {}

type SpawnCelldInput = {
  readonly projectFolder: string;
  readonly origin: URL;
  readonly settings: StackSettings;
  readonly logFile: string;
  readonly celldCommand: string;
};

type CloseLogInput = { readonly log: FileHandle; readonly path: string };

/**
 * Starts `celld dev` in a process group of its own, writing to the log, whose handle the stack closes once celld holds
 * it. Setting `CELLD_MAX_RSS_MB=0` turns off memory shedding, which counts a busy machine's page cache against celld.
 * Its `CELLD_FETCH_TIMEOUT_S` lets a model's answer stream as long as pi allows.
 */
export const spawnCelld = Effect.fn('spawnCelld')(function* ({
  projectFolder,
  origin,
  settings,
  logFile,
  celldCommand,
}: SpawnCelldInput): Effect.fn.Return<ChildProcess, StackFailed, Scope.Scope> {
  const logSubjects = [StepSubject.cases.Path.make({ path: logFile })];

  const log = yield* Effect.acquireRelease(
    Effect.tryPromise({
      try: () => open(logFile, 'a', PrivateMode.File),
      catch: (cause) => new StackFailed({ step: StackStep.OpenCelldLog, subjects: logSubjects, reason: String(cause) }),
    }),
    (opened) => closeLog({ log: opened, path: logFile }),
  );

  const listenerPort = loopbackPort({ origin });
  const port = String(listenerPort);
  const args = ['dev', projectFolder, '--host', origin.hostname, '--port', port, '--no-watch', '--logs'];
  const fetchTimeoutSeconds = String(Duration.toSeconds(CELLD_FETCH_TIMEOUT));
  const environment = { ...settings.inherited, CELLD_MAX_RSS_MB: '0', CELLD_FETCH_TIMEOUT_S: fetchTimeoutSeconds };

  return yield* Effect.callback<ChildProcess, StackFailed>((resume) => {
    const child = spawn(celldCommand, args, { env: environment, stdio: ['ignore', log.fd, log.fd], detached: true });
    const started: () => void = () => resume(Effect.succeed(child));

    const refuse: (error: Error) => void = (error) =>
      resume(Effect.fail(new StackFailed({ step: StackStep.StartCelld, reason: error.message })));

    child.once('spawn', started);
    child.on('error', refuse);
  });
}, Effect.scoped);

/** Closes the stack's handle of the log; a close that fails once celld holds its own descriptor is a defect. */
const closeLog = Effect.fn('closeLog')(function* ({ log, path }: CloseLogInput): Effect.fn.Return<void> {
  yield* Effect.tryPromise({
    try: () => log.close(),
    catch: (cause) => new LogUnclosed({ path, reason: String(cause) }),
    // A release: the stack's handle closes once, after celld holds its own descriptor.
  }).pipe(Effect.orDie);
});
