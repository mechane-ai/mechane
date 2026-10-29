import type { MechTurn } from '@mechane/testing';
import { Array } from 'effect';

/** The turns whose requests' sessions to read. */
type SessionsInput = { readonly turns: ReadonlyArray<MechTurn> };

/** The provider sessions the turns' requests named, each once. */
export function sessions({ turns }: SessionsInput): ReadonlyArray<string> {
  const turnSessions: (turn: MechTurn) => ReadonlyArray<string> = ({ requests }) =>
    requests.map(({ sessionId }) => sessionId);

  return Array.dedupe(turns.flatMap(turnSessions));
}
