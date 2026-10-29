import { DroneId, ThreadId } from '@mechane/records';
import { Schema } from 'effect';
import { Type } from 'typebox';

/**
 * A thread's id as the model passes it, which pi checks against this TypeBox schema, the only kind its tools take. It
 * carries no bounds: each tool decodes it with the protocol's schema.
 */
export const ThreadIdParameter = Type.String({ description: 'The id of the thread, as your threads section lists it' });

/** What an opening found: the thread opened, or none past the most open threads a mech keeps. */
export const ThreadOpeningOutcome = Schema.TaggedUnion({
  /** A thread opened, now or by an earlier attempt of its task. */
  Opened: { threadId: ThreadId },
  /** An opening past the most threads a mech keeps open. */
  ThreadsFull: {},
});

export type ThreadOpeningOutcome = typeof ThreadOpeningOutcome.Type;

/** What a change of a thread found: made, or refused, which records nothing. */
export const ThreadChangeOutcome = Schema.TaggedUnion({
  /** A thread changed, or already as the change asks. */
  Updated: {},
  /** A change of a thread the mech never opened. */
  ThreadMissing: {},
  /** A change of a resolved thread, whose state is final. */
  ThreadResolved: {},
});

export type ThreadChangeOutcome = typeof ThreadChangeOutcome.Type;

/** A drone started, now or by an earlier attempt of its task. */
const DroneStarted = Schema.TaggedStruct('Started', { droneId: DroneId });

/** A start past the most drones a mech runs at once. */
const DronesFull = Schema.TaggedStruct('DronesFull', {});

/** What a start of a drone found: the drone started, or why none did. */
export const DroneStartOutcome = Schema.Union([
  DroneStarted,
  ThreadChangeOutcome.cases.ThreadMissing,
  ThreadChangeOutcome.cases.ThreadResolved,
  DronesFull,
]).pipe(Schema.toTaggedUnion('_tag'));

export type DroneStartOutcome = typeof DroneStartOutcome.Type;
