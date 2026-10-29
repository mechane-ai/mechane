import type { RecordId } from '@mechane/records';
import { WorkspaceStep } from '@mechane/sandbox-wire';
import { Deferred, Effect, Result } from 'effect';
import type { ChildProcess } from 'node:child_process';
import { WorkspaceFailed } from '../errors.ts';
import { outputTail } from '../executions/output-tail.ts';
import type { ArchiveProcess } from './types.ts';

type ObserveArchiveProcessInput = ArchiveProcess & {
  readonly generation: RecordId;
  readonly resume: (answer: Effect.Effect<ArchiveProcess, WorkspaceFailed>) => void;
};

type ArchiveOutcomeInput = {
  readonly generation: RecordId;
  /** Absent when the process ended from a signal instead of an exit status. */
  readonly code: ChildProcess['exitCode'];
  readonly output: ReturnType<typeof outputTail>;
};

/** Observes startup and completion immediately, retaining only the bounded diagnostic tail. */
export function observeArchiveProcess({ generation, child, exited, resume }: ObserveArchiveProcessInput): void {
  const output = outputTail();

  const refused: (error: Error) => void = (error) => {
    const reason = error.message;
    const failure = new WorkspaceFailed({ generation, step: WorkspaceStep.Archive, reason });

    resume(failure);
  };

  const started: () => void = () => {
    const ready = Result.succeed({ child, exited });
    const answer = Effect.fromResult(ready);

    resume(answer);
  };

  const closed: (code: ChildProcess['exitCode']) => void = (code) => {
    const completed = archiveOutcome({ generation, code, output });

    Deferred.doneUnsafe(exited, completed);
  };

  child.stderr.on('data', (chunk: Buffer) => output.push({ chunk }));
  child.once('spawn', started);
  child.once('error', refused);
  child.once('close', closed);
}

/** A nonzero exit or signal carries the same archive failure as the original tar process. */
const archiveOutcome = Effect.fn('archiveOutcome')(function* ({
  generation,
  code,
  output,
}: ArchiveOutcomeInput): Effect.fn.Return<void, WorkspaceFailed> {
  if (code === 0) {
    return;
  }

  const diagnostic = output.output();

  return yield* new WorkspaceFailed({ generation, step: WorkspaceStep.Archive, reason: diagnostic.text });
});
