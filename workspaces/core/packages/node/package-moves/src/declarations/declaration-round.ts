import type { FileUnwritable, InputUnreadable, MoveStep } from '@mechane/checks-kernel';
import { parsedSources, workspaceMembers, writeChanges } from '@mechane/checks-kernel';
import { placementIndex } from '@mechane/modules';
import type { Move } from '@mechane/modules';
import { entryFiles, feasibleMoves, moveChanges } from '@mechane/normalizers';
import { Array, Effect } from 'effect';
import { MoveRefused } from '../errors.ts';
import { declarationMoves } from './declaration-moves.ts';

/** The declaration moves a step names. */
type DeclarationRoundInput = { readonly declarations: MoveStep['declarations'] };

/**
 * One round of a step's declaration moves over the tree as it stands. It writes the moves it can make and answers them,
 * none once every named declaration has moved. A round that can make none of the moves left refuses them.
 */
export const declarationRound = Effect.fn('declarationRound')(function* ({
  declarations,
}: DeclarationRoundInput): Effect.fn.Return<ReadonlyArray<Move>, InputUnreadable | FileUnwritable | MoveRefused> {
  const members = yield* workspaceMembers();
  const index = placementIndex({ sources: yield* parsedSources({ members }), entries: yield* entryFiles({ members }) });
  const moves = declarations.flatMap((declaration) => declarationMoves({ index, declaration }));
  const feasible = feasibleMoves({ index, moves, allowCycles: true });

  if (Array.isReadonlyArrayNonEmpty(moves) && !Array.isReadonlyArrayNonEmpty(feasible)) {
    /** The unit's name as code. */
    const quotedName: (move: Move) => string = ({ unit }) => `\`${unit.name}\``;
    const names = moves.map(quotedName).join(', ');

    return yield* new MoveRefused({
      path: moves[0].unit.path,
      reason: `move ${names} by hand, since no round can make their moves`,
    });
  }

  if (Array.isReadonlyArrayNonEmpty(feasible)) {
    yield* writeChanges({ changes: moveChanges({ index, moves: feasible }) });
  }

  return feasible;
});
