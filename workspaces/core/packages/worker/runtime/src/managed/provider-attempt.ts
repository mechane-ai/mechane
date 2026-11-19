import type { AssistantMessage } from '@earendil-works/pi-ai';
import { ProviderDispatchRefused } from '@mechane/control-store';
import { HttpHeader, HttpMethod } from '@mechane/records';
import { Schema } from 'effect';
import { isDeepStrictEqual } from 'node:util';
import { fingerprint } from '../actor/state.ts';
import type { ModelOffer } from '../config.ts';
import { observeAnthropicGateway } from '../models/anthropic-gateway.ts';
import { gatewayEndpoint } from '../models/gateway-address.ts';
import { resolveGatewayCredential } from '../models/gateway-credentials.ts';
import { charge, reservation, sessionListCost, usageTransport } from '../models/gateway.ts';
import type { RawUsage } from '../models/gateway.ts';
import { matchesGatewayModel } from '../models/managed-offers.ts';
import { rejectRedirect } from '../tools/http.ts';
import { modelHttpFailures, modelStreamFailure } from './model-error.ts';
import type { ManagedExecution, ManagedRequest } from './provider-types.ts';

const WireEffort = Schema.optionalKey(Schema.NullOr(Schema.String));
const EffortConfiguration = Schema.optionalKey(Schema.NullOr(Schema.Struct({ effort: WireEffort })));

const ModelRequest = Schema.fromJsonString(
  Schema.Struct({
    model: Schema.NonEmptyString,
    speed: Schema.optionalKey(Schema.NullOr(Schema.String)),
    reasoning_effort: WireEffort,
    reasoning: EffortConfiguration,
    output_config: EffortConfiguration,
  }),
);

const RECEIPT_GRACE_MS = 60_000;
const decodeRequest = Schema.decodeUnknownSync(ModelRequest);
export const MANAGED_MODEL_TIMEOUT_MS = 180_000;

type AttemptInput = {
  readonly owner: ManagedRequest;
  readonly execution: ManagedExecution;
  readonly offer: ModelOffer;
  readonly signal?: AbortSignal | undefined;
};

function requireOwner(expected: ManagedExecution, actual: ManagedExecution): void {
  if (!isDeepStrictEqual(expected, actual)) {
    throw new Error('The active conversation changed before model dispatch');
  }
}

function matchesRequest(body: string, offer: ModelOffer, execution: ManagedExecution): boolean {
  const request = decodeRequest(body);

  const hasRequestedSpeed = (request.speed ?? 'standard') === (execution.speed ?? 'standard');

  if (request.model !== offer.id || !hasRequestedSpeed) {
    return false;
  }

  if (execution.effort === undefined) {
    return true;
  }

  if (offer.protocol === 'anthropic-messages') {
    return request.output_config?.effort === execution.effort;
  }

  return (request.reasoning_effort ?? request.reasoning?.effort) === execution.effort;
}

function resourceUrl(resource: RequestInfo | URL): string {
  if (resource instanceof Request) {
    return resource.url;
  }

  return String(resource);
}

function verifyReportedModel(chunk: unknown, id: string, isPreviouslyVerified: boolean): boolean {
  if (typeof chunk !== 'object' || chunk === null) {
    return false;
  }

  if ('model' in chunk && typeof chunk.model === 'string' && chunk.model.length > 0) {
    if (!matchesGatewayModel(id, chunk.model)) {
      return false;
    }

    return true;
  }

  return isPreviouslyVerified;
}

export function managedAttempt({ owner, execution, offer, signal }: AttemptInput) {
  const scope = { id: crypto.randomUUID(), workspaceId: owner.workspaceId, mechId: execution.runtimeMechId };

  const state: {
    wasUsed: boolean;
    wasSent: boolean;
    isFinished: boolean;
    span: Awaited<ReturnType<ManagedRequest['beginModelSpan']>> | undefined;
    usage: RawUsage | null;
    fingerprint: string | null;
    error: string | undefined;
  } = {
    wasUsed: false,
    wasSent: false,
    isFinished: false,
    span: undefined,
    usage: null,
    fingerprint: null,
    error: undefined,
  };

  const expectedUrl = gatewayEndpoint(owner.configuration, offer.protocol);

  async function verifyOwner(): Promise<void> {
    try {
      requireOwner(execution, await owner.current());
    } catch (error) {
      state.error = 'The model request was superseded before dispatch';

      throw error;
    }
  }

  async function resolveCredential(): Promise<string> {
    try {
      return await resolveGatewayCredential({ ...owner, execution, signal });
    } catch (error) {
      state.error = 'gateway_credential_failed';

      throw error;
    }
  }

  async function authorize(requestFingerprint: string): Promise<string> {
    const identity = { ...scope, requestFingerprint };

    try {
      await verifyOwner();

      const credential = await resolveCredential();

      await verifyOwner();

      const marked = await owner.withControl((store) =>
        store.markProviderAttemptDispatched({
          ...identity,
          usageTimeoutMs: MANAGED_MODEL_TIMEOUT_MS + RECEIPT_GRACE_MS,
        }),
      );

      if (!marked.wasMarked) {
        throw new Error('The upstream dispatch already has an uncertain receipt');
      }

      return credential;
    } catch (error) {
      if (Schema.is(ProviderDispatchRefused)(error)) {
        state.error = error.reason;
      }

      const recorded = await owner.withControl((store) => store.getProviderAttempt(scope));

      if (recorded?.state === 'reserved') {
        await owner.withControl((store) => store.releaseUnusedProviderAttempt(identity));
      }

      throw error;
    }
  }

  const trustedFetch: typeof fetch = async (resource, init) => {
    if (state.wasUsed) {
      throw new Error('A provider attempt may dispatch only one request');
    }

    state.wasUsed = true;

    const url = new URL(resourceUrl(resource));

    if (url.href !== expectedUrl.href || init?.method?.toUpperCase() !== HttpMethod.Post) {
      throw new Error('The provider request is outside the configured endpoint');
    }

    if (typeof init.body !== 'string' || !matchesRequest(init.body, offer, execution)) {
      state.error = 'The gateway request did not match the session model settings';

      throw new Error(state.error);
    }

    const requestFingerprint = await fingerprint({ model: offer.id, body: init.body });
    const identity = { ...scope, requestFingerprint };
    state.fingerprint = requestFingerprint;

    await verifyOwner();

    const decision = await owner.withControl((store) =>
      store.reserveManagedProviderAttempt({
        ...identity,
        activationId: execution.activationId,
        generationTaskId: execution.eventId,
        provider: 'mechane',
        model: offer.id,
        reservedMicros: reservation(offer),
        managed: { sessionId: execution.sessionId, threadId: execution.threadId },
      }),
    );

    if (decision.status === 'refused') {
      state.error = decision.reason;

      throw new Error(decision.reason);
    }

    const credential = await authorize(requestFingerprint);

    try {
      await verifyOwner();
      init.signal?.throwIfAborted();

      state.span = await owner.beginModelSpan(execution, scope.id, signal);

      await verifyOwner();
      init.signal?.throwIfAborted();
    } catch (error) {
      await owner.withControl((store) => store.releaseUnsentManagedDispatch(identity));

      throw error;
    }

    const signals = [AbortSignal.timeout(MANAGED_MODEL_TIMEOUT_MS)];

    if (init.signal !== undefined && init.signal !== null) {
      signals.push(init.signal);
    }

    const headers = new Headers(init.headers);

    headers.delete(HttpHeader.Authorization);
    headers.delete(HttpHeader.ApiKey);

    if (offer.protocol === 'anthropic-messages' && owner.configuration.model.credentials.type === 'static') {
      headers.set(HttpHeader.ApiKey, credential);
    } else {
      headers.set(HttpHeader.Authorization, `Bearer ${credential}`);
    }

    state.wasSent = true;
    const response = await fetch(resource, { ...init, headers, redirect: 'manual', signal: AbortSignal.any(signals) });

    state.error = modelHttpFailures.get(response.status);

    await rejectRedirect(response);

    function recordError(error: unknown): void {
      state.error = modelStreamFailure(error) ?? state.error;
    }

    if (offer.protocol === 'anthropic-messages') {
      return observeAnthropicGateway({
        response,
        modelId: offer.id,
        speed: execution.speed ?? 'standard',
        recordError,
        recordUsage: (usage) => {
          state.usage = usage;
        },
        onViolation: (reason) => {
          state.usage = null;
          state.error = reason;
        },
      });
    }

    const reported = { isVerified: false };

    return usageTransport({
      response,
      recordError,
      recordUsage: (usage) => {
        if (reported.isVerified) {
          state.usage = usage;
        }
      },
      verifyChunk: (chunk) => {
        if (typeof chunk === 'object' && chunk !== null && 'error' in chunk) {
          return;
        }

        reported.isVerified = verifyReportedModel(chunk, offer.id, reported.isVerified);

        if (reported.isVerified) {
          return;
        }

        state.usage = null;
        state.error = 'The model gateway did not serve the selected model';

        throw new Error(state.error);
      },
    });
  };

  async function settle(): Promise<void> {
    if (!state.wasSent || state.fingerprint === null) {
      return;
    }

    const requestFingerprint = state.fingerprint;
    const usage = state.usage;
    const actualMicros = charge(offer, usage);

    if (usage === null || actualMicros === null) {
      await owner.withControl((store) => store.markManagedUsageUnconfirmed({ ...scope, requestFingerprint }));

      return;
    }

    const listCost = sessionListCost(offer, usage);

    await owner.withControl((store) =>
      store.settleProviderAttempt({
        ...scope,
        requestFingerprint,
        actualMicros,
        upstreamUsage: usage,
        listCostPicodollars: listCost,
      }),
    );
  }

  async function finish(message?: AssistantMessage): Promise<void> {
    if (state.isFinished) {
      return;
    }

    state.isFinished = true;

    try {
      await settle();
    } catch (error) {
      await state.span?.finish({ isError: true, usage: state.usage });

      throw error;
    }

    if (message === undefined || state.usage === null) {
      await state.span?.finish({ isError: true, usage: state.usage });

      return;
    }

    await state.span?.finish({ isError: false, usage: state.usage, message });
  }

  return {
    fetch: trustedFetch,
    reason: () => state.error,
    measured: () => charge(offer, state.usage) !== null,
    finish,
  };
}
