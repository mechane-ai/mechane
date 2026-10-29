import { Event } from '@mechane/protocol';
import { Effect, Schema } from 'effect';
import { CliUndecoded } from '../../errors.ts';
import type { FollowerInput } from './types.ts';

/** The JSON Lines records of `mechane event list`, each read only for the event it carries. */
const EventRecords = Schema.Array(Schema.fromJsonString(Schema.Struct({ result: Event })));

type EventRecords = typeof EventRecords.Type;

/** The events of every whole line the follower has written; the last line may still be partial. */
export const followedEvents = Effect.fn('followedEvents')(function* ({
  running,
  command,
}: FollowerInput): Effect.fn.Return<ReadonlyArray<Event>, CliUndecoded> {
  const lines = running.stdout().split('\n').slice(0, -1);
  const stderr = running.stderr();

  const records = yield* Schema.decodeUnknownEffect(EventRecords)(lines).pipe(
    Effect.mapError((error) => new CliUndecoded({ command, stderr, reason: error.message })),
  );

  return records.map((record) => record.result);
});
