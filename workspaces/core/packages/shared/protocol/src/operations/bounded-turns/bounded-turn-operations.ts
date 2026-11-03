import { cancelBoundedTurn } from './cancel-bounded-turn.ts';
import { showBoundedTurn } from './show-bounded-turn.ts';
import { submitBoundedTurn } from './submit-bounded-turn.ts';

/** The catalog exposes submission, retrieval, and cancellation under one durable request identity. */
export const BOUNDED_TURN_OPERATIONS = { submitBoundedTurn, showBoundedTurn, cancelBoundedTurn } as const;
