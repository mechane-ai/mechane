import { HttpStatusCode, SHA256_PATTERN } from '@mechane/records';
import { HookNotFoundError } from '@workflow/errors';
import { Redacted } from 'effect';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { resumeHook } from 'workflow/api';
import { loadRuntimeConfiguration } from '../config.ts';
import { withRuntimeStore } from '../store/runtime-store.ts';
import { NexusRequestEvent } from './request-schema.ts';

const MAXIMUM_EVENT_BYTES = 32_768;
const SIGNATURE_TOLERANCE_SECONDS = 300;
const MILLISECONDS_PER_SECOND = 1000;
const TERMINAL_RUN_STATES: ReadonlySet<string> = new Set(['completed', 'failed', 'cancelled']);

type SignedRequestEvent = { readonly rawBody: string; readonly timestamp: string; readonly signature: string };
type AcceptedRequestEvent = { readonly status: 'accepted' };
type RejectionStatus = typeof HttpStatusCode.BadRequest | typeof HttpStatusCode.Unauthorized;

export class RequestEventRejectedError extends Error {
  readonly status: RejectionStatus;

  constructor(status: RejectionStatus = HttpStatusCode.Unauthorized) {
    super('Nexus event was not accepted.');

    this.name = 'RequestEventRejectedError';
    this.status = status;
  }
}

export async function acceptNexusRequestEvent({
  rawBody,
  timestamp,
  signature,
}: SignedRequestEvent): Promise<AcceptedRequestEvent> {
  const configuration = loadRuntimeConfiguration().nexusEvents;

  if (configuration === null || Buffer.byteLength(rawBody) > MAXIMUM_EVENT_BYTES) {
    throw new RequestEventRejectedError();
  }

  const isSignatureFormValid = /^\d+$/u.test(timestamp) && SHA256_PATTERN.test(signature.toLowerCase());

  if (!isSignatureFormValid) {
    throw new RequestEventRejectedError();
  }

  const seconds = Number(timestamp);
  const currentSeconds = Date.now() / MILLISECONDS_PER_SECOND;

  if (!Number.isSafeInteger(seconds) || Math.abs(currentSeconds - seconds) > SIGNATURE_TOLERANCE_SECONDS) {
    throw new RequestEventRejectedError();
  }

  const expected = createHmac('sha256', Redacted.value(configuration.secret))
    .update(`${timestamp}.${rawBody}`)
    .digest();

  const actual = Buffer.from(signature, 'hex');

  if (!timingSafeEqual(actual, expected)) {
    throw new RequestEventRejectedError();
  }

  const event = decodeEvent(rawBody);

  const wait = await withRuntimeStore(async (store) => {
    const isConfigured = await store.isRequestServiceConfigured({ serviceId: event.serviceId });

    if (!isConfigured) {
      throw new RequestEventRejectedError();
    }

    return await store.recordRequestEvent(event);
  });

  if (wait === null) {
    return { status: 'accepted' };
  }

  try {
    await resumeHook(wait.hookToken, { eventId: event.id, status: event.request.status });
  } catch (error) {
    if (!HookNotFoundError.is(error)) {
      throw error;
    }

    const isClosed = await withRuntimeStore(async (store) => {
      const current = await store.getRequestWait({
        serviceId: event.serviceId,
        requestId: event.request.id,
        kind: event.request.kind,
      });

      if (current === null || current.closedAt !== null || current.deliveredAt !== null) {
        return true;
      }

      const run = await store.getRun({ runId: wait.runId });

      return run === null || TERMINAL_RUN_STATES.has(run.status);
    });

    if (!isClosed) {
      throw error;
    }

    return { status: 'accepted' };
  }

  await withRuntimeStore(
    async (store) =>
      await store.markRequestEventDelivered({
        serviceId: event.serviceId,
        requestId: event.request.id,
        kind: event.request.kind,
        eventId: event.id,
      }),
  );

  return { status: 'accepted' };
}

function decodeEvent(rawBody: string) {
  try {
    return NexusRequestEvent.parse(JSON.parse(rawBody));
  } catch {
    throw new RequestEventRejectedError(HttpStatusCode.BadRequest);
  }
}
