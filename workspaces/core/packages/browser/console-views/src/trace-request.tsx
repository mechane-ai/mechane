import { Dispatch } from '@mechane/protocol';
import type { TracedDispatch } from '@mechane/protocol';
import { Badge, Details, Divider, Identifier, Muted, Row, Stack, Subheading } from '@mechane/ui';
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
          <Badge tone={request.status === 'refused' ? 'negative' : settled ? 'positive' : 'neutral'}>
            {request.status}
          </Badge>
        </Row>
        <Muted>{request.model}</Muted>
      </Stack>
      <Divider />
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
      {settled && request.basis === 'usage' ? (
        <>
          <Divider />
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
        </>
      ) : (
        <Muted>
          {request.status === 'refused'
            ? 'Allowance refused before a model call was sent.'
            : settled
              ? 'The provider did not report usage. This request was charged at its reservation.'
              : 'Awaiting settlement. Final cost and token usage are not yet recorded.'}
        </Muted>
      )}
      <Divider />
      <Stack compact>
        <Muted>Request ID</Muted>
        <Identifier>{request.id}</Identifier>
      </Stack>
    </Stack>
  );
}
