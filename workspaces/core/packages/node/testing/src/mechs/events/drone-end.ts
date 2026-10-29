import { EventType } from '@mechane/protocol';
import { Array } from 'effect';
import type { Option } from 'effect';
import type { DroneEndEvent, DroneIdInput, EventsInput } from './types.ts';

/** The events the follower wrote, and the drone whose end to pick. */
type DroneEndInput = EventsInput & DroneIdInput;

/** The end of the drone, with its report or its reason for none, none while it has not come. */
export function droneEnd({ events, droneId }: DroneEndInput): Option.Option<DroneEndEvent> {
  return Array.findFirst(
    events.filter((event) => event.type === EventType.DroneReported || event.type === EventType.DroneUnreported),
    (event) => event.droneId === droneId,
  );
}
