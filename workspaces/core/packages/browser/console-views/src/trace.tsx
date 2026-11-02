import { Dispatch, Turn } from '@mechane/protocol';
import type { Trace } from '@mechane/protocol';
import {
  Badge,
  Cell,
  CostChart,
  EmptyState,
  Identifier,
  Metric,
  MetricGrid,
  Muted,
  Panel,
  Stack,
  Subheading,
  Table,
} from '@mechane/ui';
import { DateTime, Schema } from 'effect';
import type { ReactNode } from 'react';
import { moneyLabel, timeLabel } from './format.ts';

export function TurnTrace({ trace }: { readonly trace: Trace }): ReactNode {
  const known = trace.dispatches.filter(Schema.is(Dispatch));
  const settled = known.filter((dispatch) => dispatch.status === 'settled');
  const cost = settled.reduce((total, dispatch) => total + dispatch.settledMicros, 0);
  const turn = trace.turn;
  const duration = Schema.is(Turn)(turn) ? turnDuration(turn) : 'Unknown';

  return (
    <Stack>
      <MetricGrid>
        <Metric
          label="Outcome"
          value={<Badge tone={turn.status === 'answered' ? 'positive' : 'neutral'}>{turn.status}</Badge>}
        />
        <Metric label="Duration" value={duration} />
        <Metric
          label="Settled model cost"
          value={moneyLabel(cost)}
          detail={
            <Muted>
              {trace.dispatches.length} model {trace.dispatches.length === 1 ? 'request' : 'requests'}
            </Muted>
          }
        />
      </MetricGrid>
      <Panel>
        <Stack compact>
          <Subheading>Model requests</Subheading>
          <Muted>
            Each request reserves allowance before calling the model. Costs below are recorded by the runtime.
          </Muted>
          {settled.length > 1 && (
            <CostChart
              samples={settled.map((dispatch, index) => ({
                id: dispatch.id,
                label: `Request ${index + 1}`,
                micros: dispatch.settledMicros,
              }))}
            />
          )}
        </Stack>
      </Panel>
      <Panel padded={false}>
        {trace.dispatches.length === 0 ? (
          <EmptyState title="No model requests recorded">The turn has not made a model request yet.</EmptyState>
        ) : (
          <Table label="Model dispatches" headers={['Request / model', 'Status', 'Cost', 'Time']}>
            {trace.dispatches.map((dispatch) => (
              <tr key={dispatch.id}>
                <Cell>
                  <Stack compact>
                    <Identifier>{dispatch.id}</Identifier>
                    <Muted>{dispatch.model}</Muted>
                  </Stack>
                </Cell>
                <Cell>
                  <Badge>{dispatch.status}</Badge>
                </Cell>
                <Cell>
                  <Muted>
                    {Schema.is(Dispatch)(dispatch) && dispatch.status === 'settled'
                      ? moneyLabel(dispatch.settledMicros)
                      : 'Not settled'}
                  </Muted>
                </Cell>
                <Cell>
                  <Muted>{Schema.is(Dispatch)(dispatch) ? timeLabel(dispatch.decidedAt) : 'Unknown'}</Muted>
                </Cell>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
      <Panel>
        <Stack compact>
          <Subheading>Turn context</Subheading>
          <Identifier>{turn.id}</Identifier>
          {Schema.is(Turn)(turn) && (
            <Muted>
              Definition revision {turn.definitionRevision} · {turn.inboxItemIds.length} inbox items
            </Muted>
          )}
        </Stack>
      </Panel>
    </Stack>
  );
}

function turnDuration(turn: Turn): string {
  if (turn.status === 'running') {
    return 'In progress';
  }

  return `${((DateTime.toEpochMillis(turn.endedAt) - DateTime.toEpochMillis(turn.startedAt)) / 1000).toFixed(1)}s`;
}
