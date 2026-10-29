import type { Drone } from '@mechane/protocol';
import type { CommandGate, TurnEndEvent } from '@mechane/testing';

/** The turn a drone's report started: the items it took, its end, and whether that end holds the report. */
export type ReportTurn = {
  readonly inboxItemIds: ReadonlyArray<string>;
  readonly ended: TurnEndEvent;
  readonly isReportAnswered: boolean;
};

/**
 * What starting the drones left: the gate the first drone waits at, the sequence of the starting turn's end, and the
 * two drones in the order they started.
 */
export type StartedDrones = {
  readonly gate: CommandGate;
  readonly after: number;
  readonly gated: Drone;
  readonly sleeping: Drone;
};
