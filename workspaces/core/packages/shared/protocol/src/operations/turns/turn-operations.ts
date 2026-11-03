import { cancelTurn } from './cancel-turn.ts';
import { listTurnEvents } from './list-turn-events.ts';
import { listTurns } from './list-turns.ts';
import { showTurn } from './show-turn.ts';

/** Inspection and cancellation of admitted turns. */
export const TURN_OPERATIONS = { showTurn, cancelTurn, listTurns, listTurnEvents } as const;
