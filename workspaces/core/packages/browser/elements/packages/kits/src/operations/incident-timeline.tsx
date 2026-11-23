import type { ReactNode } from 'react';
import type { FigureProps, FigureSelectionProps } from '../../../charts/src/index.ts';
import { EventStrip } from '../../../charts/src/timeline/index.ts';
import type { EventStripLane, EventStripTime } from '../../../charts/src/timeline/index.ts';

/** What kind of thing happened. Each kind has its own lane. */
export type OperationEventKind = 'deploy' | 'alert' | 'incident';

/** Something that happened to the service. */
export type OperationEvent = {
  readonly id: string;
  readonly kind: OperationEventKind;
  readonly label: string;
  /** When it started, in milliseconds since the epoch. */
  readonly start: number;
  /** When it ended, after `start`. Leave it out for an instant, such as a deploy or an alert. */
  readonly end?: number | undefined;
  /** One sentence of detail, such as the severity or the change. */
  readonly detail?: string | undefined;
};

/** The lane names IncidentTimeline writes itself. Each has an English default. */
export type IncidentTimelineLabels = Readonly<Record<OperationEventKind, string>>;

export type IncidentTimelineProps = FigureProps &
  FigureSelectionProps &
  EventStripTime & {
    readonly events: ReadonlyArray<OperationEvent>;
    /** The first and last instant shown, in milliseconds. Use the range of the charts beside it. */
    readonly window: readonly [start: number, end: number];
    readonly labels?: Partial<IncidentTimelineLabels> | undefined;
  };

const defaultLabels: IncidentTimelineLabels = { deploy: 'Deploys', alert: 'Alerts', incident: 'Incidents' };

/**
 * Deploys, alerts and incidents in three lanes over the same time range as the charts. An instant is a dot and an
 * interval a bar. The application owns the selected event and the time format, which names its time zone.
 */
export function IncidentTimeline({ events, window, labels, ...strip }: IncidentTimelineProps): ReactNode {
  const words = { ...defaultLabels, ...labels };

  const lanes: ReadonlyArray<EventStripLane> = [
    { id: 'deploy', label: words.deploy, tone: 'series1' },
    { id: 'alert', label: words.alert, tone: 'series3' },
    { id: 'incident', label: words.incident, tone: 'negative' },
  ];

  return (
    <EventStrip
      {...strip}
      lanes={lanes}
      events={events.map(({ kind, ...event }) => ({ ...event, laneId: kind }))}
      domain={window}
    />
  );
}
