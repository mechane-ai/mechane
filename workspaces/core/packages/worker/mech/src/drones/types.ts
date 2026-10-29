import type { EventDraft } from '@mechane/mech-store';
import type { DroneId, ThreadId } from '@mechane/records';
import type { DroneEnding } from './schemas.ts';

/** A drone that ended, the thread it worked on, the id its report item takes, and how it ended. */
export type DroneReportInput = {
  readonly droneId: DroneId;
  readonly threadId: ThreadId;
  readonly reportInboxItemId: string;
  readonly ending: DroneEnding;
};

/** What a drone's end tells its mech, and the event that reports it. */
export type DroneReport = { readonly text: string; readonly event: EventDraft };
