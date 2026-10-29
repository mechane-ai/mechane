import { cancelTurn } from './cancel-turn.ts';
import { showTurn } from './show-turn.ts';

/** Inspection and cancellation of admitted turns. */
export const TURN_OPERATIONS = { showTurn, cancelTurn } as const;
