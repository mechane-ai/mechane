import { EventType } from '@mechane/protocol';
import type { DroneEndEvent, EventFollower, ScenarioFailure } from '@mechane/testing';
import { Effect } from 'effect';
import type { ReportTurn } from './types.ts';

/** A drone's end, and the follower that reads the turn its report item started. */
type ReportTurnInput = { readonly follower: EventFollower; readonly end: DroneEndEvent };

type DroneEndInput = { readonly end: DroneEndEvent };

/**
 * The turn the drone's report item started, followed to its end, which log order puts after earlier reports' turns. The
 * report must be its only item, and its reply must hold what the report says.
 */
export const reportTurn = Effect.fn('reportTurn')(function* ({
  follower,
  end,
}: ReportTurnInput): Effect.fn.Return<ReportTurn, ScenarioFailure> {
  const started = yield* follower.awaitTurnStart({ inboxItemId: end.inboxItemId });
  const ended = yield* follower.awaitTurnEnd();
  const isReportTurn = started.inboxItemIds.join(',') === end.inboxItemId && ended.turnId === started.turnId;

  return {
    inboxItemIds: started.inboxItemIds,
    ended,
    isReportAnswered:
      isReportTurn && ended.type === EventType.TurnAnswered && ended.reply.includes(reportWords({ end })),
  };
});

/** What a drone's report item says of its end: the drone's report, or its reason for none. */
function reportWords({ end }: DroneEndInput): string {
  switch (end.type) {
    case EventType.DroneReported:
      return end.report;
    case EventType.DroneUnreported:
      return `ended without a report: ${end.reason}`;
  }
}
