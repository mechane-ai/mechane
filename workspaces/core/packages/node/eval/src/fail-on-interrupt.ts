import { Effect } from 'effect';
import { EvalInterrupted } from './errors.ts';

/** The signal a person sends from a terminal with Ctrl-C. */
const INTERRUPT_SIGNAL = 'SIGINT';

type FailOnInterruptInput<A, E> = { readonly program: Effect.Effect<A, E>; readonly outFolder: string };

/** The out folder of the run that a Ctrl-C interrupts. */
type InterruptionInput = { readonly outFolder: string };

/**
 * Fails as `EvalInterrupted` at the first Ctrl-C, and removes its handler once the race ends. It takes only the first,
 * so a second Ctrl-C ends the process at once, where `interruptOnSignal` would hold it until the cleanup ends. The CLI
 * runs no `interruptOnSignal`, so this is the eval's one handler.
 */
const interruption = Effect.fn('interruption')(function* ({
  outFolder,
}: InterruptionInput): Effect.fn.Return<never, EvalInterrupted> {
  return yield* Effect.callback<never, EvalInterrupted>((resume) => {
    const stop: () => void = () => resume(Effect.fail(new EvalInterrupted({ outFolder })));
    // The eval's one handler takes only the first Ctrl-C, which no `interruptOnSignal` can (EF-11).
    // ast-grep-ignore: process-signal
    const remove: () => void = () => process.off(INTERRUPT_SIGNAL, stop);

    // The eval's one handler takes only the first Ctrl-C, which no `interruptOnSignal` can (EF-11).
    // ast-grep-ignore: process-signal
    process.once(INTERRUPT_SIGNAL, stop);

    return Effect.sync(remove);
  });
});

/**
 * Runs `program` until it ends, or until Ctrl-C interrupts it, which fails as `EvalInterrupted` once its finalizers
 * ran. The handler takes only the first Ctrl-C, so a second one ends the process at once, as a terminal expects.
 */
export const failOnInterrupt = Effect.fn('failOnInterrupt')(function* <A, E>({
  program,
  outFolder,
}: FailOnInterruptInput<A, E>): Effect.fn.Return<A, E | EvalInterrupted> {
  return yield* Effect.raceFirst(program, interruption({ outFolder }));
});
