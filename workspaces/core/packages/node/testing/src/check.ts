import { Effect } from 'effect';
import { CheckFailed } from './errors.ts';

type CheckInput = { readonly name: string; readonly conditions: ReadonlyArray<boolean>; readonly detail: string };

/**
 * Reports one named check on standard output, which fails when any of its conditions does not hold, with its detail,
 * which the smoke's report writes.
 */
export const check = Effect.fn('check')(function* ({
  name,
  conditions,
  detail,
}: CheckInput): Effect.fn.Return<void, CheckFailed> {
  if (conditions.includes(false)) {
    console.log(`not ok ${name}`);

    return yield* new CheckFailed({ name, reason: detail });
  }

  console.log(`ok ${name}`);
});
