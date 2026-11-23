import type { ReactNode } from 'react';
import { Status } from '../../../core/src/index.ts';
import type { RunState, RunStateLabels } from './runs.ts';

const stateTones = { running: 'neutral', finished: 'positive', failed: 'negative', stopped: 'warning' } as const;

/** A run's state in words, with a small icon that never carries the meaning alone. */
export function RunStateText({
  state,
  labels,
}: {
  readonly state: RunState;
  readonly labels: RunStateLabels;
}): ReactNode {
  return <Status tone={stateTones[state]}>{labels[state]}</Status>;
}
