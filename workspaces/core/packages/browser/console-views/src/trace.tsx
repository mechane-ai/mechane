import { Dispatch, Turn } from '@mechane/protocol';
import type { Trace } from '@mechane/protocol';
import {
  Button,
  Details,
  EmptyState,
  Identifier,
  Inspector,
  Metric,
  MetricGrid,
  Muted,
  Notice,
  Panel,
  Stack,
  Status,
  Subheading,
  Timeline,
} from '@mechane/ui';
import type { TimelineItem } from '@mechane/ui';
import { DateTime, Schema } from 'effect';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { durationLabel, moneyLabel, preciseTimeLabel } from './format.ts';
import { TraceRequest } from './trace-request.tsx';

export function TurnTrace({ trace }: { readonly trace: Trace }): ReactNode {
  const [selection, setSelection] = useState<string>();
  const selected = trace.dispatches.find((request) => request.id === selection) ?? trace.dispatches[0];
  const known = trace.dispatches.filter(Schema.is(Dispatch));
  const settled = known.filter((request) => request.status === 'settled');
  const cost = settled.reduce((total, request) => total + request.settledMicros, 0);
  const usage = settled.filter((request) => request.basis === 'usage');

  const tokens = usage.reduce(
    (total, request) =>
      total + request.inputTokens + request.outputTokens + request.cacheReadTokens + request.cacheWriteTokens,
    0,
  );

  const turn = trace.turn;
  const isKnownTurn = Schema.is(Turn)(turn);

  const requestTimes = known.flatMap((request) => [
    DateTime.toEpochMillis(request.decidedAt),
    ...(request.status === 'settled' ? [DateTime.toEpochMillis(request.settledAt)] : []),
  ]);

  const start = isKnownTurn
    ? DateTime.toEpochMillis(turn.startedAt)
    : requestTimes.length === 0
      ? 0
      : Math.min(...requestTimes);

  const turnEnd = isKnownTurn && turn.status !== 'running' ? DateTime.toEpochMillis(turn.endedAt) : undefined;
  const end = Math.max(start, turnEnd ?? start, ...requestTimes);

  const timeline: ReadonlyArray<TimelineItem> = known.map((request) => ({
    id: request.id,
    label: `Request ${trace.dispatches.indexOf(request) + 1}`,
    detail: request.model,
    start: DateTime.toEpochMillis(request.decidedAt),
    end: request.status === 'settled' ? DateTime.toEpochMillis(request.settledAt) : null,
    state: request.status === 'settled' ? 'complete' : request.status === 'refused' ? 'refused' : 'pending',
    summary:
      request.status === 'settled'
        ? `${durationLabel(DateTime.toEpochMillis(request.settledAt) - DateTime.toEpochMillis(request.decidedAt))} · ${moneyLabel(request.settledMicros)}`
        : request.status,
  }));

  return (
    <Stack>
      <MetricGrid>
        <Metric
          label="Turn duration"
          value={
            turnEnd === undefined ? (turn.status === 'running' ? 'Running' : 'Unknown') : durationLabel(turnEnd - start)
          }
          detail={
            <Status
              tone={turn.status === 'answered' ? 'positive' : turn.status === 'unanswered' ? 'negative' : 'neutral'}
            >
              {turn.status}
            </Status>
          }
        />
        <Metric
          label="Settled model cost"
          value={moneyLabel(cost)}
          detail={
            <Muted>
              {settled.length} of {trace.dispatches.length} requests settled
            </Muted>
          }
        />
        <Metric
          label="Reported tokens"
          value={usage.length === 0 ? '—' : tokens.toLocaleString()}
          detail={
            <Muted>
              Usage available for {usage.length} of {trace.dispatches.length} requests
            </Muted>
          }
        />
      </MetricGrid>
      {isKnownTurn && turn.status === 'unanswered' && (
        <Notice error>Turn ended without an answer: {turn.reason.replaceAll('_', ' ')}.</Notice>
      )}
      {selected === undefined ? (
        <Panel>
          <EmptyState title="No model requests recorded">
            Requests appear here after the runtime checks their allowance.
          </EmptyState>
        </Panel>
      ) : (
        <Stack compact>
          <Inspector
            master={
              <>
                <Timeline
                  items={timeline}
                  start={start}
                  end={end}
                  selected={selected.id}
                  onSelect={setSelection}
                  duration={durationLabel(end - start)}
                />
                {trace.dispatches
                  .filter((request) => !Schema.is(Dispatch)(request))
                  .map((request) => (
                    <Button key={request.id} tone="quiet" onClick={() => setSelection(request.id)}>
                      Request {trace.dispatches.indexOf(request) + 1} · newer format
                    </Button>
                  ))}
              </>
            }
            detail={<TraceRequest request={selected} number={trace.dispatches.indexOf(selected) + 1} />}
          />
          <Muted>
            Intervals run from allowance reservation to settlement. Tool execution and provider internals are not
            recorded as spans.
            {known.length === trace.dispatches.length ? '' : ' Some requests use a newer record format.'}
          </Muted>
        </Stack>
      )}
      {isKnownTurn && (
        <Stack compact>
          <Subheading>Turn details</Subheading>
          <Details
            items={[
              { label: 'Started', value: preciseTimeLabel(turn.startedAt) },
              { label: 'Definition', value: `Revision ${turn.definitionRevision}` },
              { label: 'Inputs', value: turn.inboxItemIds.length },
              { label: 'Turn ID', value: <Identifier>{turn.id}</Identifier> },
            ]}
          />
        </Stack>
      )}
    </Stack>
  );
}
