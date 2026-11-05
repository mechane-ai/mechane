import { Collapsible, CopyValue, IconButton, Muted, Row, Stack, Status, Subheading } from '@mechane-ai/elements';
import { BreakdownBar } from '@mechane-ai/elements/charts/cartesian';
import { Details } from '@mechane-ai/elements/collections';
import { JsonViewer } from '@mechane-ai/elements/content';
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
        <CopyValue
          label="request link"
          value={href}
          display="icon"
          render={<IconButton aria-label="Copy request link" variant="ghost" />}
        />
        <Muted>This request uses a newer record format.</Muted>
        <CopyValue label="request ID" value={request.id} />
      </Stack>
    );
  }

  const settled = request.status === 'settled';

  return (
    <Stack>
      <Stack compact>
        <Row between>
          <Subheading>Request {number}</Subheading>
          <CopyValue
            label="request link"
            value={href}
            display="icon"
            render={<IconButton aria-label="Copy request link" variant="ghost" />}
          />
        </Row>
        <Row between>
          <Muted>{request.model}</Muted>
          <Status tone={request.status === 'refused' ? 'negative' : settled ? 'positive' : 'neutral'}>
            {request.status}
          </Status>
        </Row>
        {settled && (
          <Row>
            <span>{moneyLabel(request.settledMicros)} charged</span>
            <Muted>
              {durationLabel(DateTime.toEpochMillis(request.settledAt) - DateTime.toEpochMillis(request.decidedAt))} to
              settlement
            </Muted>
          </Row>
        )}
      </Stack>
      {settled && request.basis === 'usage' ? (
        <BreakdownBar
          title="Reported tokens"
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
      <Collapsible.Root>
        <Collapsible.Trigger>Request metadata</Collapsible.Trigger>
        <Collapsible.Panel>
          <Details
            items={[
              { label: 'Request ID', value: <CopyValue label="request ID" value={request.id} /> },
              { label: 'Allowance requested', value: moneyLabel(request.requestedMicros) },
              {
                label: 'Decided at',
                value: (
                  <CopyValue label="decision time in UTC" value={preciseTimeLabel(request.decidedAt)}>
                    {timeLabel(request.decidedAt)}
                  </CopyValue>
                ),
              },
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
                    { label: 'Cost basis', value: request.basis === 'usage' ? 'Reported usage' : 'Reservation' },
                  ]
                : []),
            ]}
          />
        </Collapsible.Panel>
      </Collapsible.Root>
      <Collapsible.Root>
        <Collapsible.Trigger>Recorded request data</Collapsible.Trigger>
        <Collapsible.Panel>
          <JsonViewer label="Recorded request JSON" value={Schema.encodeSync(Dispatch)(request)} />
        </Collapsible.Panel>
      </Collapsible.Root>
    </Stack>
  );
}
