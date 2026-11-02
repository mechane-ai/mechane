import { Turn } from '@mechane/protocol';
import type { TurnPage } from '@mechane/protocol';
import { Badge, Button, Cell, EmptyState, Identifier, Muted, Panel, Stack, Table } from '@mechane/ui';
import { Schema } from 'effect';
import type { ReactNode } from 'react';
import { timeLabel } from './format.ts';

export function TurnList({
  page,
  onOpen,
}: {
  readonly page: TurnPage;
  readonly onOpen: (id: Turn['id']) => void;
}): ReactNode {
  if (page.turns.length === 0) {
    return (
      <Panel>
        <EmptyState title="No turns yet">
          Send a message to start the mech’s first turn. Its work will appear here.
        </EmptyState>
      </Panel>
    );
  }

  return (
    <Panel padded={false}>
      <Table label="Recent turns" headers={['Turn', 'Outcome', 'Started', '']}>
        {page.turns.map((turn) => (
          <tr key={turn.id}>
            <Cell>
              <Identifier>{turn.id}</Identifier>
            </Cell>
            <Cell>
              <Stack compact>
                <Badge
                  tone={turn.status === 'answered' ? 'positive' : turn.status === 'running' ? 'warning' : 'neutral'}
                >
                  {turn.status}
                </Badge>
                {Schema.is(Turn)(turn) && turn.status === 'unanswered' && <Muted>{turn.reason}</Muted>}
              </Stack>
            </Cell>
            <Cell>
              <Muted>{Schema.is(Turn)(turn) ? timeLabel(turn.startedAt) : 'Unknown'}</Muted>
            </Cell>
            <Cell>
              <Button tone="quiet" onClick={() => onOpen(turn.id)}>
                View trace →
              </Button>
            </Cell>
          </tr>
        ))}
      </Table>
    </Panel>
  );
}
