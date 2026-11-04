import { Columns, CopyValue, Details, Divider, Muted, Row, Stack, Status, Subheading } from '@mechane-ai/ui';
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
          <Stack compact>
            <Subheading>Token usage</Subheading>
            <Details
              items={[
                { label: 'Input', value: request.inputTokens.toLocaleString() },
                { label: 'Output', value: request.outputTokens.toLocaleString() },
                { label: 'Cache read', value: request.cacheReadTokens.toLocaleString() },
                { label: 'Cache write', value: request.cacheWriteTokens.toLocaleString() },
              ]}
            />
            <Muted>Input excludes cached tokens.</Muted>
          </Stack>
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
    </Stack>
  );
}
