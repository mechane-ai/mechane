import { originKey, unitNeeds } from '@mechane/modules';
import type { Move, PlacementIndex } from '@mechane/modules';

/** One round's index and the candidate moves into one destination. */
type IncomingClaimsInput = { readonly index: PlacementIndex; readonly incoming: ReadonlyArray<Move> };

/** A name a landing unit binds at the destination, and the key of what it binds. */
type Claim = { readonly local: string; readonly origin: string };

/** What each name binds at a destination after the round, as each unit landing there and its needs claim it. */
export function incomingClaims({ index, incoming }: IncomingClaimsInput): ReadonlyMap<string, ReadonlySet<string>> {
  /** The names a landing unit and its needs bind at the destination. */
  const moveClaims: (move: Move) => ReadonlyArray<Claim> = (move) => [
    { local: move.unit.name, origin: originKey(move.unit) },
    ...unitNeeds({ index, move }).map(({ local, origin }) => ({ local, origin })),
  ];

  /** The keys a name's claims bind it to, under the name. */
  const nameClaims: (group: readonly [string, ReadonlyArray<Claim>]) => readonly [string, ReadonlySet<string>] = ([
    local,
    group,
  ]) => [local, new Set(group.map(({ origin }) => origin))];

  return new Map([...Map.groupBy(incoming.flatMap(moveClaims), ({ local }) => local)].map(nameClaims));
}
