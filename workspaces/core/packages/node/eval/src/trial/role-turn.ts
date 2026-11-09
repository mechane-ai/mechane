import { NotificationId, TurnStatus } from '@mechane/protocol';
import type { ConsoleMessage, Turn } from '@mechane/protocol';
import { MechId } from '@mechane/records';
import { Array, Effect, Option } from 'effect';
import { PUBLICATION_INSTRUCTIONS, RoleStatus } from '../constants.ts';
import type { Intent } from '../schemas.ts';
import type { TurnOutcome, TurnRecord } from '../store/schemas.ts';
import type { EvalRunFailure } from '../types.ts';
import { awaitTurnEnd } from './await-turn-end.ts';
import { readRolePublication } from './read-role-publication.ts';
import type { RoleTurnInput } from './types.ts';

type RoleIntentInput = Omit<RoleTurnInput, 'text'>;

export const roleTurn = Effect.fn('roleTurn')(function* ({
  call,
  access,
  mech,
  text,
  intent,
}: RoleTurnInput): Effect.fn.Return<TurnRecord, EvalRunFailure> {
  const { token, workspaceId } = access;
  const { mechId, notificationId } = yield* roleIntent({ call, access, mech, intent });

  yield* call({
    name: 'sendNotification',
    input: { workspaceId, mechId, notificationId, text, source: { name: 'eval', eventId: notificationId } },
    credential: token,
  });

  const runs = yield* awaitTurnEnd({ call, access, mechId, notificationId });
  const [first, ...remaining] = runs;
  const runIds = [first.id, ...remaining.map((run) => run.id)] as const;

  const traces = yield* Effect.forEach(
    runIds,
    (turnId) => call({ name: 'showTurn', input: { workspaceId, mechId, turnId }, credential: token }),
    { concurrency: 1 },
  );

  const roleRunIds = new Set(runIds);
  const publication = yield* readRolePublication({ call, access, mechId, runIds: roleRunIds });
  const messageId = Option.map(publication, (message) => message.id);

  return {
    mechId,
    notificationId,
    runIds,
    messageId,
    outcome: roleOutcome({ runs, publication }),
    dispatches: traces.flatMap((trace) => trace.dispatches),
  };
});

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
  const configuredInstructions = Option.fromUndefinedOr(mech.instructions);

  const instructions = Option.match(configuredInstructions, {
    onNone: () => PUBLICATION_INSTRUCTIONS,
    onSome: (text) => `${text}\n\n${PUBLICATION_INSTRUCTIONS}`,
  });

  const created = yield* call({ name: 'createMech', input: { ...mech, instructions, workspaceId }, credential: token });
  const record = { mechId: MechId.make(created.id), notificationId: NotificationId.make(crypto.randomUUID()) };

  yield* intent.create({ record });

  return record;
});

type RoleOutcomeInput = { readonly runs: ReadonlyArray<Turn>; readonly publication: Option.Option<ConsoleMessage> };

function roleOutcome({ runs, publication }: RoleOutcomeInput): TurnOutcome {
  const failed = Array.findFirst(runs, (run) => run.status === TurnStatus.Failed);

  if (Option.isSome(failed)) {
    return { status: RoleStatus.Failed, reason: failed.value.reason };
  }

  if (runs.some((run) => run.status === TurnStatus.Stopped)) {
    return { status: RoleStatus.Stopped };
  }

  if (Option.isNone(publication)) {
    return { status: RoleStatus.NoReply };
  }

  return { status: RoleStatus.Published, reply: publication.value.text };
}
