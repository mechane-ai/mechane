import { Turn } from '@mechane/protocol';
import type { TurnPage } from '@mechane/protocol';
import { Schema } from 'effect';

type ListedTurn = TurnPage['turns'][number];

const SHORT_RUN_ID_LENGTH = 8;

/** The API supplies a bounded first-input prefix. Absence means no readable excerpt, including newer record formats. */
export function runInput(turn: ListedTurn): string | undefined {
  if (!Schema.is(Turn)(turn)) {
    return undefined;
  }

  const input = turn.inputExcerpt?.trim();

  return input === '' ? undefined : input;
}

/** Display titles retain recorded wording so list rows and run pages identify the same work. */
export function runLabel(turn: ListedTurn): string {
  const input = runInput(turn);

  return input?.split('\n', 1)[0] ?? runIdentifier(turn);
}

/** Short IDs are display labels only. Routing and copying must keep the full run ID. */
export function runIdentifier(turn: ListedTurn): string {
  return `Run ${turn.id.slice(0, SHORT_RUN_ID_LENGTH)}`;
}
