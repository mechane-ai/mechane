import { HttpHeader, HttpMethod, MediaType } from '@mechane/records';
import { createHmac, randomUUID } from 'node:crypto';

type RequestOutcome = {
  readonly id: string;
  readonly type: 'nexus.request.resolved';
  readonly occurredAt: string;
  readonly serviceId: string;
  readonly request: {
    readonly id: string;
    readonly kind: 'access' | 'vend';
    readonly status: 'ready' | 'denied' | 'expired' | 'cancelled';
    readonly approvalId: string;
  };
};

type OutcomeInput = {
  readonly serviceId: string;
  readonly requestId: string;
  readonly kind: RequestOutcome['request']['kind'];
  readonly status: RequestOutcome['request']['status'];
  readonly approvalId: string;
};

type DeliveryInput = { readonly origin: URL; readonly signingSecret: string; readonly event: RequestOutcome };

const EVENT_TIMEOUT_MS = 15_000;
const MILLISECONDS_PER_SECOND = 1000;

export function createNexusOutcome(input: OutcomeInput): RequestOutcome {
  return {
    id: randomUUID(),
    type: 'nexus.request.resolved',
    occurredAt: new Date().toISOString(),
    serviceId: input.serviceId,
    request: { id: input.requestId, kind: input.kind, status: input.status, approvalId: input.approvalId },
  };
}

export async function deliverNexusOutcome(input: DeliveryInput): Promise<Response> {
  const body = JSON.stringify(input.event);
  const timestamp = String(Math.floor(Date.now() / MILLISECONDS_PER_SECOND));
  const signature = createHmac('sha256', input.signingSecret).update(`${timestamp}.${body}`).digest('hex');

  return await fetch(new URL('/api/nexus/request-events', input.origin), {
    method: HttpMethod.Post,
    headers: {
      [HttpHeader.ContentType]: MediaType.Json,
      [HttpHeader.NexusEventTimestamp]: timestamp,
      [HttpHeader.NexusEventSignature]: signature,
    },
    body,
    signal: AbortSignal.timeout(EVENT_TIMEOUT_MS),
  });
}
