import { Status } from '@mechane-ai/elements';
import type { ReactNode } from 'react';

export function SessionStatus({
  status,
  stopReason,
  isExecuting,
  isWaiting,
  queuePosition,
}: {
  readonly status: string;
  readonly isExecuting?: boolean | undefined;
  readonly isWaiting?: boolean | undefined;
  readonly queuePosition?: number | undefined;
  readonly stopReason?: string | null | undefined;
}): ReactNode {
  if (isExecuting === true) {
    return <Status tone="positive">Working now</Status>;
  }

  if (isWaiting === true) {
    const label =
      queuePosition !== undefined && queuePosition > 0 ? `Waiting for agent (#${queuePosition})` : 'Waiting for agent';

    return <Status>{label}</Status>;
  }

  switch (status) {
    case 'running':
      return <Status>Running</Status>;
    case 'rescheduling':
      return <Status tone="warning">Rescheduling</Status>;
    case 'terminated':
      return <Status>Ended</Status>;
    case 'idle':
      switch (stopReason ?? '') {
        case 'requires_action':
          return <Status tone="warning">Needs action</Status>;
        case 'budget_reached':
          return <Status tone="warning">Budget reached</Status>;
        case 'refusal':
          return <Status tone="warning">Refused</Status>;
        case 'retries_exhausted':
          return <Status tone="negative">Retries exhausted</Status>;
        default:
          return <Status>Idle</Status>;
      }
    default:
      return <Status>{status}</Status>;
  }
}
