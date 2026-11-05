import { Muted, Stack, Status } from '@mechane-ai/elements';
import { DataTable } from '@mechane-ai/elements/collections';
import { EmptyState } from '@mechane-ai/elements/feedback';
import { Turn } from '@mechane/protocol';
import type { TurnPage } from '@mechane/protocol';
import { DateTime, Schema } from 'effect';
import type { ReactNode } from 'react';
import { durationLabel, timeLabel } from './format.ts';
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
        label: (turn) =>
          `Inspect ${Schema.is(Turn)(turn) && turn.inputExcerpt !== undefined && turn.inputExcerpt.length > 0 ? turn.inputExcerpt : 'run'}`,
      }}
      columns={[
        {
          id: 'input',
          label: 'Run',
          cell: (turn) => (
            <Stack compact>
              <span>
                {Schema.is(Turn)(turn) && turn.inputExcerpt !== undefined && turn.inputExcerpt.length > 0
                  ? turn.inputExcerpt
                  : 'Input unavailable'}
              </span>
              {Schema.is(Turn)(turn) && turn.status === 'unanswered' && <Muted>{outcomeReason(turn.reason)}</Muted>}
            </Stack>
          ),
          truncate: true,
        },
        {
          id: 'outcome',
          label: 'Outcome',
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
          secondary: true,
          cell: (turn) => (Schema.is(Turn)(turn) ? timeLabel(turn.startedAt) : 'Unavailable'),
        },
        {
          id: 'elapsed',
          label: 'Elapsed',
          secondary: true,
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
