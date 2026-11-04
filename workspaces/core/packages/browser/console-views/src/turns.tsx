import { Cell, EmptyState, Muted, Stack, Status, Table } from '@mechane-ai/ui';
import { Turn } from '@mechane/protocol';
import type { TurnPage } from '@mechane/protocol';
import { DateTime, Schema } from 'effect';
import type { ReactNode } from 'react';
import { durationLabel, timeLabel } from './format.ts';
import { outcomeLabel, outcomeReason } from './turn-outcome.ts';

export function TurnList({
  page,
  turnLink,
  emptyAction,
  emptyDescription,
}: {
  readonly page: TurnPage;
  readonly turnLink: (id: Turn['id'], children: ReactNode) => ReactNode;
  readonly emptyAction?: ReactNode;
  readonly emptyDescription: string;
}): ReactNode {
  if (page.turns.length === 0) {
    return (
      <EmptyState title="No turns yet" action={emptyAction}>
        {emptyDescription}
      </EmptyState>
    );
  }

  return (
    <Table
      label="Recent turns"
      headers={[
        { label: 'Turn', width: 52 },
        { label: 'Started', width: 30, secondary: true },
        { label: 'Elapsed', width: 18 },
      ]}
    >
      {page.turns.map((turn) => {
        const known = Schema.is(Turn)(turn);
        const time = known ? timeLabel(turn.startedAt) : 'Time unavailable';

        const duration =
          known && turn.status !== 'running'
            ? durationLabel(DateTime.toEpochMillis(turn.endedAt) - DateTime.toEpochMillis(turn.startedAt))
            : '—';

        return (
          <tr key={turn.id}>
            <Cell mobileLabel={time}>
              <Stack compact>
                {turnLink(
                  turn.id,
                  <Status
                    tone={
                      turn.status === 'answered' ? 'positive' : turn.status === 'unanswered' ? 'negative' : 'neutral'
                    }
                  >
                    {outcomeLabel(turn.status)}
                  </Status>,
                )}
                {known && turn.status === 'unanswered' && <Muted>{outcomeReason(turn.reason)}</Muted>}
              </Stack>
            </Cell>
            <Cell secondary>{time}</Cell>
            <Cell>{duration}</Cell>
          </tr>
        );
      })}
    </Table>
  );
}
