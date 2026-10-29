import { Delivery } from '@mechane/protocol';
import { Effect, Option } from 'effect';
import type { Intent } from '../schemas.ts';
import type { TurnRecord } from '../store/schemas.ts';
import type { EvalRunFailure } from '../types.ts';
import { awaitTurnEnd } from './await-turn-end.ts';
import type { RoleTurnInput } from './types.ts';

type RoleIntentInput = Omit<RoleTurnInput, 'text'>;

/**
 * Runs one role's turn under its intent: a fresh mech and inbox item id saved before the first send, or a dead run's.
 * The deployment receives the item under the intent's id at most once. The turn's dispatches come from its trace once
 * its events say it ended.
 */
export const roleTurn = Effect.fn('roleTurn')(function* ({
  call,
  access,
  mech,
  text,
  intent,
}: RoleTurnInput): Effect.fn.Return<TurnRecord, EvalRunFailure> {
  const { token, workspaceId } = access;
  const { mechId, inboxItemId } = yield* roleIntent({ call, access, mech, intent });

  yield* call({
    name: 'sendInboxItem',
    input: { workspaceId, mechId, inboxItemId, text, delivery: Delivery.WhenIdle },
    credential: token,
  });

  const { turnId, outcome } = yield* awaitTurnEnd({ call, access, mechId });
  const { dispatches } = yield* call({ name: 'showTurn', input: { workspaceId, mechId, turnId }, credential: token });

  return { mechId, inboxItemId, turnId, outcome, dispatches };
});

/**
 * The role's saved intent, or else a fresh one: the role's mech, created now, and a fresh inbox item id, saved before
 * anything is sent to the mech.
 */
const roleIntent = Effect.fn('roleIntent')(function* ({
  call,
  access,
  mech,
  intent,
}: RoleIntentInput): Effect.fn.Return<Intent, EvalRunFailure> {
  const saved = yield* intent.read();

  if (Option.isSome(saved)) {
    return saved.value;
  }

  const { token, workspaceId } = access;
  const { id: mechId } = yield* call({ name: 'createMech', input: { ...mech, workspaceId }, credential: token });
  const record = { mechId, inboxItemId: crypto.randomUUID() };

  yield* intent.create({ record });

  return record;
});
