import { listTurnEvents } from './list-turn-events.ts';
import { listTurns } from './list-turns.ts';
import { showTurn } from './show-turn.ts';

/** Inspection of historical turns. */
export const TURN_OPERATIONS = { showTurn, listTurns, listTurnEvents } as const;
