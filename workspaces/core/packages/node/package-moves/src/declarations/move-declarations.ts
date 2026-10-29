import type { FileUnwritable, InputUnreadable, MoveStep } from '@mechane/checks-kernel';
import { Effect } from 'effect';
import type { MoveRefused } from '../errors.ts';
import { declarationRound } from './declaration-round.ts';

/** The declaration moves a step names. */
type MoveDeclarationsInput = { readonly declarations: MoveStep['declarations'] };

/**
 * Moves the declarations a step names from one role file to another, in rounds, before its files move. Each move
 * carries the imports it needs, each import of it and an entry's export, and a round may close a cycle a later one
 * opens. A move no round can make is refused: it would strand a binding, take a bound name or break the role order.
 */
export const moveDeclarations = Effect.fn('moveDeclarations')(function* ({
  declarations,
}: MoveDeclarationsInput): Effect.fn.Return<void, InputUnreadable | FileUnwritable | MoveRefused> {
  let made = yield* declarationRound({ declarations });

  while (made.length > 0) {
    made = yield* declarationRound({ declarations });
  }
});
