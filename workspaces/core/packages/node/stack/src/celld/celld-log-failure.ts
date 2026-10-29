import { StepSubject } from '@mechane/program';
import { Effect } from 'effect';
import { readFile } from 'node:fs/promises';
import { StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';

/** How many of the celld log's last lines a startup failure quotes. */
const LOG_TAIL_LINES = 8;

/** The celld log, the step of the stack celld failed, and why. */
type CelldLogFailureInput = { readonly logFile: string; readonly step: StackStep; readonly reason: string };

/** Fails with the last lines of the celld log in the reason, so a failed run names what celld refused. */
export const celldLogFailure = Effect.fn('celldLogFailure')(function* ({
  logFile,
  step,
  reason,
}: CelldLogFailureInput): Effect.fn.Return<never, StackFailed> {
  const subjects = [StepSubject.cases.Path.make({ path: logFile })];

  const text = yield* Effect.tryPromise({
    try: () => readFile(logFile, 'utf8'),
    catch: (cause) => new StackFailed({ step: StackStep.ReadCelldLog, subjects, reason: String(cause) }),
  });

  const isWritten: (line: string) => boolean = (line) => line.trim() !== '';
  const tail = text.split('\n').filter(isWritten).slice(-LOG_TAIL_LINES);

  return yield* new StackFailed({ step, reason: `${reason}; ${logFile} ends: ${tail.join(' / ')}` });
});
