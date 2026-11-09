import { Status } from '@mechane-ai/elements';
import { DataTable, DataTablePlaceholder, DataTableText } from '@mechane-ai/elements/collections';
import type { DataTableColumnLayout } from '@mechane-ai/elements/collections';
import { EmptyState } from '@mechane-ai/elements/feedback';
import { Turn } from '@mechane/protocol';
import type { TurnPage } from '@mechane/protocol';
import { DateTime, Option, Schema } from 'effect';
import type { ReactNode } from 'react';
import { durationLabel } from './format.ts';
import { ConsoleTimestamp } from './record-time.tsx';
import { runIdentifier, runInput, runLabel } from './run-label.ts';
import { outcomeLabel, outcomeReason } from './turn-outcome.ts';

const turnColumns = {
  input: { id: 'input', label: 'Run', role: 'primary' },
  outcome: { id: 'outcome', label: 'Outcome', role: 'status', width: 148 },
  created: { id: 'created', label: 'Created', role: 'timestamp', isSecondary: true, width: 172 },
  elapsed: { id: 'elapsed', label: 'Elapsed', role: 'number', isSecondary: true, width: 100 },
} as const satisfies Record<string, DataTableColumnLayout>;

export function TurnListPlaceholder(): ReactNode {
  return <DataTablePlaceholder columns={Object.values(turnColumns)} />;
}

function elapsedLabel(turn: Turn): string {
  if (Option.isNone(turn.startedAt)) {
    return 'Not started';
  }

  switch (turn.status) {
    case 'completed':
    case 'failed':
    case 'stopped':
      return durationLabel(DateTime.toEpochMillis(turn.endedAt) - DateTime.toEpochMillis(turn.startedAt.value));
    case 'queued':
    case 'running':
      return 'In progress';
  }
}

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
          ...turnColumns.input,
          cell: (turn) => (
            <DataTableText
              secondary={
                runInput(turn) === undefined
                  ? runIdentifier(turn)
                  : Schema.is(Turn)(turn) && turn.status === 'failed'
                    ? outcomeReason(turn.reason)
                    : undefined
              }
            >
              {runInput(turn) ?? runIdentifier(turn)}
            </DataTableText>
          ),
          shouldTruncate: true,
        },
        {
          ...turnColumns.outcome,
          shouldTruncate: false,
          cell: (turn) => (
            <Status tone={turn.status === 'completed' ? 'positive' : turn.status === 'failed' ? 'negative' : 'neutral'}>
              {outcomeLabel(turn.status)}
            </Status>
          ),
        },
        {
          ...turnColumns.created,
          shouldTruncate: false,
          cell: (turn) => (Schema.is(Turn)(turn) ? <ConsoleTimestamp value={turn.createdAt} /> : 'Unavailable'),
        },
        {
          ...turnColumns.elapsed,
          shouldTruncate: false,
          cell: (turn) => (Schema.is(Turn)(turn) ? elapsedLabel(turn) : 'Unavailable'),
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
