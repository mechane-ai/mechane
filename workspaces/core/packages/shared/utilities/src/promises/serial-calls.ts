import { Option } from 'effect';
import { afterSettling } from '../after-settling.ts';

type SerialCallInput<A> = { readonly run: () => Promise<A> };
type SerialCalls = { readonly run: <A>(input: SerialCallInput<A>) => Promise<A> };

/** A rejected call still releases its successor, while its caller receives the original rejection. */
export function serialCalls(): SerialCalls {
  const state = { pending: Option.none<Promise<void>>() };

  const run: SerialCalls['run'] = async ({ run: operation }) => {
    const predecessor = state.pending;
    const completion = Promise.withResolvers<void>();

    state.pending = Option.some(completion.promise);

    if (Option.isSome(predecessor)) {
      await predecessor.value;
    }

    const promise = operation();

    return await afterSettling({ promise, run: completion.resolve });
  };

  return { run };
}
