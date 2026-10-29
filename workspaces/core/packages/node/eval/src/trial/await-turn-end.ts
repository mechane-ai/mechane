import type { ClientFailure, OperationCall } from '@mechane/client';
import { MechPath, WAIT_MAX } from '@mechane/protocol';
import { Array, Effect, Option, Schema, Stream } from 'effect';
import type { WorkspaceAccess } from '../types.ts';
import { turnEnd } from './turn-end.ts';
import type { TurnEnd } from './types.ts';

type AwaitTurnEndInput = {
  readonly call: OperationCall<'listEvents'>;
  readonly access: WorkspaceAccess;
  readonly mechId: string;
};

/** A page of a mech's events to read for turn ends, after the sequence `after`. */
type TurnEndPageInput = AwaitTurnEndInput & { readonly after: number };

/** The turn ends of a page of events, and the sequence the next page starts after. */
type TurnEndPage = readonly [ReadonlyArray<TurnEnd>, Option.Option<number>];

/** The sequence before a log's first event, where a fresh mech's events start. */
const LOG_START = 0;

/** The stream of a mech's turn ends stopped, which it never does on its own, since each page reads on. */
class TurnEndsStopped extends Schema.TaggedError<TurnEndsStopped>()('TurnEndsStopped', { mech: MechPath }) {}

/**
 * Follows a fresh mech's events from the start of its log to the end of its first turn, the turn of the one inbox item
 * it received. Each page waits as long as a list may, and the wait has no deadline of its own, since the turn's
 * dispatches have theirs.
 */
export const awaitTurnEnd = Effect.fn('awaitTurnEnd')(function* ({
  call,
  access,
  mechId,
}: AwaitTurnEndInput): Effect.fn.Return<TurnEnd, ClientFailure> {
  const page: (after: number) => Effect.Effect<TurnEndPage, ClientFailure> = (after) =>
    turnEndPage({ call, access, mechId, after });

  const first = yield* Stream.runHead(Stream.paginate(LOG_START, page));

  if (Option.isNone(first)) {
    // The event pages never end, since each page's cursor follows the log, so the stream's head is always there.
    const stopped = new TurnEndsStopped({ mech: { workspaceId: access.workspaceId, mechId } });

    return yield* Effect.die(stopped);
  }

  return first.value;
});

/** The turn ends among the events after `after`, and the last event's sequence, after which the next page starts. */
const turnEndPage = Effect.fn('turnEndPage')(function* ({
  call,
  access,
  mechId,
  after,
}: TurnEndPageInput): Effect.fn.Return<TurnEndPage, ClientFailure> {
  const { token, workspaceId } = access;
  const input = { workspaceId, mechId, after, wait: WAIT_MAX };
  const { events } = yield* call({ name: 'listEvents', input, credential: token });
  const next = Option.match(Array.last(events), { onNone: () => after, onSome: (last) => last.sequence });

  return [Array.getSomes(Array.map(events, (event) => turnEnd({ event }))), Option.some(next)];
});
