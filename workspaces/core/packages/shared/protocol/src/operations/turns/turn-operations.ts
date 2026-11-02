import { cancelTurn } from './cancel-turn.ts';
import { listTurns } from './list-turns.ts';
import { showTurn } from './show-turn.ts';

/** Inspection and cancellation of admitted turns. */
export const TURN_OPERATIONS = { showTurn, cancelTurn, listTurns } as const;
