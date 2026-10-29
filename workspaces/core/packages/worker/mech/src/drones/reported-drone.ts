import { EventType, INBOX_TEXT_MAX_CHARS } from '@mechane/protocol';
import type { DroneReport, DroneReportInput } from './types.ts';

/** A drone that ended with its final reply, the thread it worked on, and the id its report item takes. */
type ReportedDroneInput = Omit<DroneReportInput, 'ending'> & { readonly report: string };

/**
 * A drone's final reply as its mech reads it, and the event that reports it. The reply is cut so the item's text fits
 * an inbox item, with a character the cut splits replaced, so the text stays well formed.
 */
export function reportedDrone({ droneId, threadId, reportInboxItemId, report }: ReportedDroneInput): DroneReport {
  const opening = `Drone ${droneId} reported on thread ${threadId}:\n`;
  const cut = report.slice(0, INBOX_TEXT_MAX_CHARS - opening.length).toWellFormed();

  return {
    text: `${opening}${cut}`,
    event: { type: EventType.DroneReported, droneId, inboxItemId: reportInboxItemId, report: cut },
  };
}
