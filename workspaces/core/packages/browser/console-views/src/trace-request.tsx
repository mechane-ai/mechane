import { Dispatch } from '@mechane/protocol';
import type { TracedDispatch } from '@mechane/protocol';
import { Columns, Details, Divider, Identifier, Muted, Row, Stack, Status, Subheading } from '@mechane/ui';
import { DateTime, Schema } from 'effect';
import type { ReactNode } from 'react';
import { durationLabel, moneyLabel, preciseTimeLabel } from './format.ts';

export function TraceRequest({
  request,
  number,
}: {
  readonly request: TracedDispatch;
  readonly number: number;
}): ReactNode {
  if (!Schema.is(Dispatch)(request)) {
    return (
      <Stack>
        <Subheading>Request {number}</Subheading>
        <Muted>This request uses a newer record format.</Muted>
        <Identifier>{request.id}</Identifier>
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
        <Muted>{request.model}</Muted>
      </Stack>
      <Divider />
      <Columns>
        <Stack compact>
          <Subheading>Settlement</Subheading>
          <Details
            items={[
              { label: 'Decided at', value: preciseTimeLabel(request.decidedAt) },
              { label: 'Allowance request', value: moneyLabel(request.requestedMicros) },
              ...(settled
                ? [
                    { label: 'Settled at', value: preciseTimeLabel(request.settledAt) },
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
        <Identifier>{request.id}</Identifier>
      </Stack>
    </Stack>
  );
}
