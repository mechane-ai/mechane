import { Deferred, Effect, Option } from 'effect';
import type { Scope } from 'effect';

/** The signals that ask a program to stop; `interruptOnSignal` interrupts the program on the first one. */
const STOP_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;

type InterruptOnSignalInput<A, E> = { readonly program: Effect.Effect<A, E> };

type CompletedProgramInput<A, E> = { readonly program: Effect.Effect<A, E> };

/**
 * Runs `program` until it ends, with its value, or until a stop signal interrupts it, with none. The handlers stay
 * installed until the interrupted program's finalizers finish, so a repeated signal cannot end the process in the
 * middle of its cleanup.
 */
export const interruptOnSignal = Effect.fn('interruptOnSignal')(function* <A, E>({
  program,
}: InterruptOnSignalInput<A, E>): Effect.fn.Return<Option.Option<A>, E, Scope.Scope> {
  const signalled = yield* Deferred.make<Option.Option<never>>();
  const stop: () => void = () => Deferred.doneUnsafe(signalled, Effect.succeedNone);

  const listen: () => void = () => {
    for (const signal of STOP_SIGNALS) {
      process.on(signal, stop);
    }
  };

  const unlisten: () => void = () => {
    for (const signal of STOP_SIGNALS) {
      process.off(signal, stop);
    }
  };

  yield* Effect.acquireRelease(Effect.sync(listen), () => Effect.sync(unlisten));

  return yield* Effect.raceFirst(completedProgram({ program }), Deferred.await(signalled));
}, Effect.scoped);

/** The program's value once it ends, as some value. */
const completedProgram = Effect.fn('completedProgram')(function* <A, E>({
  program,
}: CompletedProgramInput<A, E>): Effect.fn.Return<Option.Option<A>, E> {
  const value = yield* program;

  return Option.some(value);
});
