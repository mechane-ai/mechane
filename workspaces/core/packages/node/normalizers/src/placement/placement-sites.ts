import type { Site } from '@mechane/checks-kernel';
import type { Move, NormalizerScope, ParsedSource } from '@mechane/modules';
import { Normalizer } from '@mechane/rule-shapes';
import { moveBlocker } from '../feasibility/move-blocker.ts';
import { blockerClause } from './blocker-clause.ts';
import { roundMoves } from './round-moves.ts';

/** The owned rule whose sites are the declarations placement leaves, which a person places by hand. */
const BLOCKED_RULE = 'placement-blocked';

/** What a site in a file the scope excludes says: placement leaves the code that no check runs to a person. */
const EXCLUDED_CLAUSE = ', by hand, since placement leaves the code no check runs';

/** Every parsed file, the entries the manifests export, the files whose declarations may move, and the roots. */
type PlacementSitesInput = {
  readonly sources: ReadonlyArray<ParsedSource>;
  readonly entries: ReadonlyMap<string, string>;
  readonly scope: NormalizerScope;
  readonly roots: ReadonlyArray<string>;
};

/** A move, the rule its site counts under, and what the site adds after the place it names. */
type PlacementSiteInput = { readonly move: Move; readonly rule: string; readonly clause: string };

/**
 * Each declaration placement's next round moves, and each it leaves under `placement-blocked`, at its first line, as
 * the check counts them. A left declaration that only others carry counts once, at each that carries it.
 */
export function placementSites({ sources, entries, scope, roots }: PlacementSitesInput): ReadonlyArray<Site> {
  const { index, feasible, gated, infeasible } = roundMoves({ sources, entries, scope, roots });

  /** The site of a move the round cannot make, with what keeps it. */
  const blockedSite: (move: Move) => Site = (move) => {
    const blocker = moveBlocker({ index, move, moves: feasible });

    return placementSite({ move, rule: BLOCKED_RULE, clause: blockerClause({ blocker }) });
  };

  return [
    ...feasible.map((move) => placementSite({ move, rule: Normalizer.Placement, clause: '' })),
    ...gated
      .filter(({ carriers }) => carriers.length === 0)
      .map((move) => placementSite({ move, rule: BLOCKED_RULE, clause: EXCLUDED_CLAUSE })),
    ...infeasible.filter(({ carriers }) => carriers.length === 0).map(blockedSite),
  ];
}

/** Where a site's declaration belongs, which `mise run fix` moves it to once the move is open to it. */
function placementSite({ move, rule, clause }: PlacementSiteInput): Site {
  const { unit, to } = move;
  const site = { rule, file: unit.path, line: unit.line };

  if (move.isPrivate) {
    return {
      ...site,
      message: `Declare \`${unit.name}\` unexported in the one file that uses it, such as \`${to}\`${clause}`,
    };
  }

  return {
    ...site,
    message: `Declare \`${unit.name}\` in the role file of the folder that holds every user, such as \`${to}\`${clause}`,
  };
}
