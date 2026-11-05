import { Status } from '@mechane-ai/elements';
import { DataTable, DataTableText } from '@mechane-ai/elements/collections';
import { EmptyState } from '@mechane-ai/elements/feedback';
import { Turn } from '@mechane/protocol';
import type { TurnPage } from '@mechane/protocol';
import { DateTime, Schema } from 'effect';
import type { ReactNode } from 'react';
import { durationLabel } from './format.ts';
import { ConsoleTimestamp } from './record-time.tsx';
import { runIdentifier, runInput, runLabel } from './run-label.ts';
import { outcomeLabel, outcomeReason } from './turn-outcome.ts';

export function TurnList({
  page,
  turnHref,
  onOpen,
  focusRowId,
  emptyAction,
  emptyDescription,
}: {
  readonly page: TurnPage;
  readonly turnHref: (id: Turn['id']) => string;
  readonly onOpen: (id: Turn['id']) => void;
  readonly focusRowId?: string | undefined;
  readonly emptyAction?: ReactNode;
  readonly emptyDescription: string;
}): ReactNode {
  return (
    <DataTable
      caption="Recent runs"
      hideCaption
      rows={page.turns}
      getRowId={(turn) => turn.id}
      focusRowId={focusRowId}
      rowAction={{
        href: (turn) => turnHref(turn.id),
        onActivate: (turn) => onOpen(turn.id),
        label: (turn) => `Inspect ${runInput(turn) ?? runLabel(turn)}`,
      }}
      columns={[
        {
          id: 'input',
          label: 'Run',
          role: 'primary',
          cell: (turn) => (
            <DataTableText
              secondary={
                runInput(turn) === undefined
                  ? runIdentifier(turn)
                  : Schema.is(Turn)(turn) && turn.status === 'unanswered'
                    ? outcomeReason(turn.reason)
                    : undefined
              }
            >
              {runInput(turn) ?? 'Input unavailable'}
            </DataTableText>
          ),
          truncate: true,
        },
        {
          id: 'outcome',
          label: 'Outcome',
          role: 'status',
          width: 148,
          truncate: false,
          cell: (turn) => (
            <Status
              tone={turn.status === 'answered' ? 'positive' : turn.status === 'unanswered' ? 'negative' : 'neutral'}
            >
              {outcomeLabel(turn.status)}
            </Status>
          ),
        },
        {
          id: 'started',
          label: 'Started',
          role: 'timestamp',
          secondary: true,
          width: 172,
          truncate: false,
          cell: (turn) => (Schema.is(Turn)(turn) ? <ConsoleTimestamp value={turn.startedAt} /> : 'Unavailable'),
        },
        {
          id: 'elapsed',
          label: 'Elapsed',
          role: 'number',
          secondary: true,
          width: 100,
          truncate: false,
          cell: (turn) =>
            Schema.is(Turn)(turn) && turn.status !== 'running'
              ? durationLabel(DateTime.toEpochMillis(turn.endedAt) - DateTime.toEpochMillis(turn.startedAt))
              : '—',
        },
      ]}
      empty={
        <EmptyState title="No runs yet" action={emptyAction}>
          {emptyDescription}
        </EmptyState>
      }
    />
  );
}
