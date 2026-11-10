import type { Bytes } from '@mechane/records';
import { Effect, Option, Result } from 'effect';
import type { Duration, Scope } from 'effect';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { GuestMisconfigured } from '../errors.ts';
import { killGroup } from '../executions/kill-group.ts';

const SUCCESS_STATUS = 0;

type RunToolCommandInput = {
  readonly name: string;
  readonly command: string;
  readonly arguments: ReadonlyArray<string>;
  readonly environment: () => Readonly<Record<string, string>>;
  readonly timeout: Duration.Duration;
  readonly maxOutputBytes: Bytes;
};

type SettleToolCommandInput = {
  readonly status: ChildProcess['exitCode'];
  readonly chunks: ReadonlyArray<Buffer>;
  readonly failure: GuestMisconfigured;
  readonly resume: (result: Effect.Effect<Buffer, GuestMisconfigured>) => void;
};

type StopToolCommandInput = Pick<ChildProcess, 'pid'>;

/** No command output or environment enters a startup failure diagnostic. */
export const runToolCommand = Effect.fn('runToolCommand')(function* ({
  name,
  command,
  arguments: arguments_,
  environment,
  timeout,
  maxOutputBytes,
}: RunToolCommandInput): Effect.fn.Return<Buffer, GuestMisconfigured, Scope.Scope> {
  const failure = new GuestMisconfigured({ reason: `${name} failed during tool bootstrap` });
  const argumentsList = [...arguments_];
  const childEnvironment = environment();

  const opening = Effect.try({
    try: () =>
      spawn(command, argumentsList, { env: childEnvironment, detached: true, stdio: ['ignore', 'pipe', 'ignore'] }),
    catch: () => new GuestMisconfigured({ reason: `start ${name} failed during tool bootstrap` }),
  });

  const child = yield* Effect.acquireRelease(opening, stopToolCommand);

  const running = Effect.callback<Buffer, GuestMisconfigured>((resume) => {
    const chunks: Array<Buffer> = [];
    const output = { bytes: 0 };

    const collect: (chunk: Buffer) => void = (chunk) => {
      output.bytes += chunk.byteLength;

      if (output.bytes > maxOutputBytes) {
        resume(failure);

        return;
      }

      chunks.push(chunk);
    };

    const refuse: () => void = () => resume(failure);

    const settle: (status: ChildProcess['exitCode']) => void = (status) =>
      settleToolCommand({ status, chunks, failure, resume });

    child.stdout.on('data', collect);
    child.once('error', refuse);
    child.once('close', settle);
  });

  return yield* running.pipe(Effect.timeoutOrElse({ duration: timeout, orElse: () => failure }));
}, Effect.scoped);

const stopToolCommand = Effect.fn('stopToolCommand')(function* ({ pid }: StopToolCommandInput): Effect.fn.Return<void> {
  const group = Option.fromUndefinedOr(pid);

  if (Option.isNone(group)) {
    return;
  }

  yield* killGroup({ groupId: group.value });
});

function settleToolCommand({ status, chunks, failure, resume }: SettleToolCommandInput): void {
  const exitStatus = Option.fromNullishOr(status);

  if (!Option.contains(exitStatus, SUCCESS_STATUS)) {
    resume(failure);

    return;
  }

  const bytes = Buffer.concat(chunks);
  const result = Result.succeed(bytes);
  const succeeded = Effect.fromResult(result);

  resume(succeeded);
}
