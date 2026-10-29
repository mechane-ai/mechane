import { Effect, Schema } from 'effect';

/** The code with which Node signals a process id under which no process runs. */
const MISSING_PROCESS_CODE = 'ESRCH';

/** No process runs under the id, as a signal 0 to it reports with `ESRCH`. */
class ProcessMissing extends Schema.TaggedError<ProcessMissing>()('ProcessMissing', { processId: Schema.Number }) {}

/** A process runs under the id but refused a signal 0 for another reason, such as belonging to another user. */
class SignalRefused extends Schema.TaggedError<SignalRefused>()('SignalRefused', { processId: Schema.Number }) {}

/** The failure with which Node signals a process id under which no process runs. */
const MissingProcess = Schema.Struct({ code: Schema.Literal(MISSING_PROCESS_CODE) });

type MissingProcess = typeof MissingProcess.Type;

type IsProcessRunningInput = { readonly processId: number };

/** Whether a process runs under the id: a signal 0 to it fails only with `ESRCH` once none does. */
export const isProcessRunning = Effect.fn('isProcessRunning')(function* ({
  processId,
}: IsProcessRunningInput): Effect.fn.Return<boolean> {
  return yield* Effect.try({
    try: () => process.kill(processId, 0),
    catch: (cause) => {
      if (Schema.is(MissingProcess)(cause)) {
        return new ProcessMissing({ processId });
      }

      return new SignalRefused({ processId });
    },
  }).pipe(Effect.catchTags({ ProcessMissing: () => Effect.succeed(false), SignalRefused: () => Effect.succeed(true) }));
});
