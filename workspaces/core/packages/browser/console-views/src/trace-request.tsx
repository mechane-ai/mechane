import { Collapsible, Columns, CopyValue, Divider, Muted, Row, Stack, Status, Subheading } from '@mechane-ai/ui';
import { BreakdownBar } from '@mechane-ai/ui/charts/cartesian';
import { Details } from '@mechane-ai/ui/collections';
import { JsonViewer } from '@mechane-ai/ui/content';
import { Dispatch } from '@mechane/protocol';
import type { TracedDispatch } from '@mechane/protocol';
import { DateTime, Schema } from 'effect';
import type { ReactNode } from 'react';
import { durationLabel, moneyLabel, preciseTimeLabel, timeLabel } from './format.ts';

export function TraceRequest({
  request,
  number,
  href,
}: {
  readonly request: TracedDispatch;
  readonly number: number;
  readonly href: string;
}): ReactNode {
  if (!Schema.is(Dispatch)(request)) {
    return (
      <Stack>
        <Subheading>Request {number}</Subheading>
        <CopyValue label="request link" value={href}>
          Copy link
        </CopyValue>
        <Muted>This request uses a newer record format.</Muted>
        <CopyValue label="request ID" value={request.id} />
      </Stack>
    );
  }

  const settled = request.status === 'settled';

  return (
    <Stack compact>
      <Stack compact>
        <Row between>
          <Subheading>Request {number}</Subheading>
          <Status tone={request.status === 'refused' ? 'negative' : settled ? 'positive' : 'neutral'}>
            {request.status}
          </Status>
        </Row>
        <Row between>
          <Muted>{request.model}</Muted>
          <CopyValue label="request link" value={href}>
            Copy link
          </CopyValue>
        </Row>
      </Stack>
      <Divider />
      <Columns>
        <Stack compact>
          <Subheading>Settlement</Subheading>
          <Details
            items={[
              {
                label: 'Decided at',
                value: (
                  <CopyValue label="reservation time in UTC" value={preciseTimeLabel(request.decidedAt)}>
                    {timeLabel(request.decidedAt)}
                  </CopyValue>
                ),
              },
              { label: 'Allowance request', value: moneyLabel(request.requestedMicros) },
              ...(settled
                ? [
                    {
                      label: 'Settled at',
                      value: (
                        <CopyValue label="settlement time in UTC" value={preciseTimeLabel(request.settledAt)}>
                          {timeLabel(request.settledAt)}
                        </CopyValue>
                      ),
                    },
                    {
                      label: 'To settlement',
                      value: durationLabel(
                        DateTime.toEpochMillis(request.settledAt) - DateTime.toEpochMillis(request.decidedAt),
                      ),
                    },
                    { label: 'Charged', value: moneyLabel(request.settledMicros) },
                    { label: 'Cost basis', value: request.basis === 'usage' ? 'Reported usage' : 'Reservation' },
                  ]
                : []),
            ]}
          />
        </Stack>
        {settled && request.basis === 'usage' ? (
          <BreakdownBar
            title="Token usage"
            items={[
              { id: 'input', label: 'Input', value: request.inputTokens, tone: 'series1' },
              { id: 'output', label: 'Output', value: request.outputTokens, tone: 'series2' },
              { id: 'cache-read', label: 'Cache read', value: request.cacheReadTokens, tone: 'series3' },
              { id: 'cache-write', label: 'Cache write', value: request.cacheWriteTokens, tone: 'series4' },
            ]}
            total={request.inputTokens + request.outputTokens + request.cacheReadTokens + request.cacheWriteTokens}
            formatValue={(value) => value.toLocaleString('en-US')}
            description="Input excludes cached tokens."
          />
        ) : (
          <Muted>
            {request.status === 'refused'
              ? 'Allowance refused before a model call was sent.'
              : settled
                ? 'The provider did not report usage. This request was charged at its reservation.'
                : 'Awaiting settlement. Final cost and token usage are not yet recorded.'}
          </Muted>
        )}
      </Columns>
      <Divider />
      <Stack compact>
        <Muted>Request ID</Muted>
        <CopyValue label="request ID" value={request.id} />
      </Stack>
      <Collapsible.Root key={request.id}>
        <Collapsible.Trigger>Recorded request data</Collapsible.Trigger>
        <Collapsible.Panel>
          <JsonViewer label="Recorded request JSON" value={Schema.encodeSync(Dispatch)(request)} />
        </Collapsible.Panel>
      </Collapsible.Root>
    </Stack>
  );
}
