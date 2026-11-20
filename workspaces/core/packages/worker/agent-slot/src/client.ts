import { HttpHeader, HttpMethod, MediaType } from '@mechane/records';
import { observeEventWithTimeout, waitForSignal } from '@mechane/utilities';
import { Duration, Schema } from 'effect';
import { AGENT_SLOT_URL, agentSlotName } from './identity.ts';
import {
  AgentSlotScope,
  SlotAcquireOutput,
  SlotAttention,
  SlotEpochOutput,
  SlotErrorPayload,
  SlotHeartbeatOutput,
} from './protocol.ts';
import type { ManagedIdentityLease, ManagedIdentitySlot, SlotNamespace } from './protocol.ts';

const HEARTBEAT_INTERVAL = Duration.millis(15_000);
const WAIT_FALLBACK_POLL = Duration.millis(1000);
const LEASE_SAFETY_MARGIN_MS = 5000;
const TRANSIENT_SLOT_TRANSPORT_PATTERN = /NodeFenced|output gate refused|no db for/iu;

function isTransientSlotTransportError(cause: unknown): boolean {
  if (cause instanceof Error) {
    return TRANSIENT_SLOT_TRANSPORT_PATTERN.test(cause.message);
  }

  return TRANSIENT_SLOT_TRANSPORT_PATTERN.test(String(cause));
}

type SlotClientInput = { readonly namespace: Pick<SlotNamespace, 'getByName'>; readonly scope: AgentSlotScope };

type SessionSlotInput = {
  readonly holderId: string;
  readonly sessionId: string;
  readonly doName: string;
  readonly instanceId: string;
  readonly wakes: EventTarget;
};

/** Creates a typed client for one agent's `AgentSlotObject` Durable Object. */
export function createAgentSlotClient({ namespace, scope }: SlotClientInput) {
  const validated = Schema.decodeUnknownSync(AgentSlotScope)(scope);
  const stub = namespace.getByName(agentSlotName(validated));

  async function call<T>(method: string, input: unknown, output: Schema.Codec<T, unknown>): Promise<T> {
    const request = new Request(AGENT_SLOT_URL, {
      method: HttpMethod.Post,
      headers: { [HttpHeader.ContentType]: MediaType.Json },
      body: JSON.stringify({ scope: validated, method, input }),
    });

    const response = await stub.fetch(request);

    if (!response.ok) {
      const parsed = Schema.decodeUnknownResult(SlotErrorPayload)(await response.json());

      if (parsed._tag === 'Success') {
        throw new Error(parsed.success.reason);
      }

      throw new Error('The agent slot returned an unexpected error');
    }

    return Schema.decodeUnknownSync(output)(await response.json());
  }

  async function attention(): Promise<SlotAttention> {
    return await call('attention', {}, SlotAttention);
  }

  async function remove(holderId: string): Promise<void> {
    await call('remove', { holderId }, Schema.Null);
  }

  async function recoverInstance(holderId: string, instanceId: string): Promise<void> {
    await call('recoverInstance', { holderId, instanceId }, Schema.Null);
  }

  function forSession({ holderId, sessionId, doName, instanceId, wakes }: SessionSlotInput): ManagedIdentitySlot {
    const leaseState: {
      mode: 'available' | 'waiting' | 'held';
      epoch: number | null;
      leaseUntilMs: number | null;
      isLost: boolean;
      heartbeatStop: AbortController | null;
      leaseLost: AbortController | null;
    } = { mode: 'available', epoch: null, leaseUntilMs: null, isLost: false, heartbeatStop: null, leaseLost: null };

    function isLeaseActive(leaseEpoch: number, stop: AbortSignal): boolean {
      return !stop.aborted && leaseState.mode === 'held' && leaseState.epoch === leaseEpoch;
    }

    function stopHeartbeat(): void {
      if (leaseState.heartbeatStop !== null) {
        leaseState.heartbeatStop.abort();

        leaseState.heartbeatStop = null;
      }
    }

    async function runHeartbeatLoop(leaseEpoch: number, stop: AbortSignal): Promise<void> {
      while (isLeaseActive(leaseEpoch, stop)) {
        await waitForSignal({ span: HEARTBEAT_INTERVAL, stop });

        if (!isLeaseActive(leaseEpoch, stop)) {
          return;
        }

        try {
          const result = await call('heartbeat', { holderId, epoch: leaseEpoch, instanceId }, SlotHeartbeatOutput);

          if (result.status === 'ok' && leaseState.epoch === leaseEpoch) {
            leaseState.leaseUntilMs = result.leaseUntilMs;
          } else if (result.status === 'lost' && leaseState.epoch === leaseEpoch) {
            leaseState.isLost = true;
            leaseState.leaseUntilMs = null;

            leaseState.leaseLost?.abort(new Error('The agent lost its execution slot'));

            stopHeartbeat();

            return;
          }
        } catch {
          // Next heartbeat tick or authoritative epoch check will verify lease health.
        }
      }
    }

    function startHeartbeat(leaseEpoch: number): void {
      stopHeartbeat();

      const controller = new AbortController();
      leaseState.heartbeatStop = controller;

      void runHeartbeatLoop(leaseEpoch, controller.signal);
    }

    async function waitForTurn(
      signal: AbortSignal,
    ): Promise<{ readonly epoch: number; readonly leaseUntilMs: number } | null> {
      signal.throwIfAborted();

      const wake = observeEventWithTimeout({ source: wakes, type: 'wake', span: WAIT_FALLBACK_POLL, stop: signal });

      try {
        const result = await call('acquire', { holderId, sessionId, doName, instanceId }, SlotAcquireOutput);

        signal.throwIfAborted();

        if (result.status === 'granted') {
          return { epoch: result.epoch, leaseUntilMs: result.leaseUntilMs };
        }

        await wake.observed;
        signal.throwIfAborted();

        return null;
      } catch (cause) {
        if (isTransientSlotTransportError(cause)) {
          await wake.observed;
          signal.throwIfAborted();

          return null;
        }

        throw cause;
      } finally {
        wake.dispose();
      }
    }

    async function acquire(signal: AbortSignal = new AbortController().signal): Promise<ManagedIdentityLease> {
      signal.throwIfAborted();

      if (leaseState.mode !== 'available') {
        throw new Error('A managed effect already holds or awaits this slot');
      }

      leaseState.mode = 'waiting';
      leaseState.leaseUntilMs = null;
      leaseState.isLost = false;
      leaseState.leaseLost = null;

      try {
        let granted = await waitForTurn(signal);

        while (granted === null) {
          granted = await waitForTurn(signal);
        }

        const leaseLost = new AbortController();

        leaseState.mode = 'held';
        leaseState.epoch = granted.epoch;
        leaseState.leaseUntilMs = granted.leaseUntilMs;
        leaseState.leaseLost = leaseLost;

        startHeartbeat(granted.epoch);

        return { epoch: granted.epoch, signal: leaseLost.signal };
      } catch (cause) {
        stopHeartbeat();

        try {
          await call('cancel', { holderId }, Schema.Null);
        } catch (cancelError) {
          if (!isTransientSlotTransportError(cancelError)) {
            throw cancelError;
          }
        } finally {
          leaseState.mode = 'available';
          leaseState.epoch = null;
          leaseState.leaseUntilMs = null;
          leaseState.isLost = false;
          leaseState.leaseLost = null;
        }

        throw cause;
      }
    }

    async function epoch(): Promise<number | null> {
      if (leaseState.isLost) {
        return null;
      }

      const leaseUntil = leaseState.leaseUntilMs;
      const hasHeldLease = leaseState.mode === 'held' && leaseState.epoch !== null;

      if (hasHeldLease && leaseUntil !== null && Date.now() < leaseUntil - LEASE_SAFETY_MARGIN_MS) {
        return leaseState.epoch;
      }

      const result = await call('epoch', { holderId }, SlotEpochOutput);

      return result.epoch;
    }

    async function release(expectedEpoch: number): Promise<void> {
      stopHeartbeat();

      if (leaseState.epoch === expectedEpoch) {
        leaseState.mode = 'available';
        leaseState.epoch = null;
        leaseState.leaseUntilMs = null;
        leaseState.isLost = false;
        leaseState.leaseLost = null;
      }

      try {
        await call('release', { holderId, expectedEpoch }, Schema.Null);
      } catch (releaseError) {
        if (!isTransientSlotTransportError(releaseError)) {
          throw releaseError;
        }
      }
    }

    return { acquire, epoch, release };
  }

  return { attention, remove, recoverInstance, forSession };
}
