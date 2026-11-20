import { HttpMethod, HttpStatusCode } from '@mechane/records';
import { DurableObject } from 'cloudflare:workers';
import { Schema } from 'effect';
import { AGENT_SLOT_URL, ownsAgentSlotAddress, SESSION_SLOT_WAKE_URL } from './identity.ts';
import {
  SlotAcquireInput,
  SlotEnvelope,
  SlotHeartbeatInput,
  SlotHolderInput,
  SlotRecoverInput,
  SlotReleaseInput,
} from './protocol.ts';
import type { AgentSlotBindings, SlotNamespace } from './protocol.ts';
import { loadAgentSlotBindings } from './settings.ts';
import { openAgentSlotStore, SlotRetiredError } from './store/slot-store.ts';

type WakeInput = { readonly doName: string };

/**
 * Isolated per-agent execution slot DO holding the single active lease, epoch, and FIFO session queue.
 *
 * @public
 */
export class AgentSlotObject extends DurableObject<AgentSlotBindings> {
  readonly #slots: SlotNamespace;
  readonly #sessions: SlotNamespace;
  readonly #store;

  constructor(state: DurableObjectState, environment: AgentSlotBindings) {
    super(state, environment);

    const bindings = loadAgentSlotBindings({ environment });
    this.#slots = bindings.slots;
    this.#sessions = bindings.sessions;
    this.#store = openAgentSlotStore(state.storage);
  }

  #scheduleWake(wakeDoName: string | null): void {
    if (wakeDoName === null) {
      return;
    }

    this.ctx.waitUntil(this.#wakeSession({ doName: wakeDoName }));
  }

  async #wakeSession({ doName }: WakeInput): Promise<void> {
    try {
      const stub = this.#sessions.getByName(doName);
      const request = new Request(SESSION_SLOT_WAKE_URL, { method: HttpMethod.Post });
      const response = await stub.fetch(request);

      await response.body?.cancel();
    } catch {
      // Waiting sessions also run a bounded safety poll and DO alarm, so a transient wake miss is self-healing.
    }
  }

  override async fetch(request: Request): Promise<Response> {
    if (request.url !== AGENT_SLOT_URL || request.method !== HttpMethod.Post) {
      return new Response(null, { status: HttpStatusCode.NotFound });
    }

    const decoded = Schema.decodeUnknownResult(SlotEnvelope)(await request.json());

    if (decoded._tag === 'Failure') {
      return Response.json({ reason: 'Invalid agent slot request' }, { status: HttpStatusCode.BadRequest });
    }

    const { scope, method, input } = decoded.success;

    if (!ownsAgentSlotAddress({ state: this.ctx, slots: this.#slots, scope })) {
      return Response.json({ reason: 'Agent slot scope mismatch' }, { status: HttpStatusCode.NotFound });
    }

    try {
      switch (method) {
        case 'acquire': {
          const parsed = Schema.decodeUnknownSync(SlotAcquireInput)(input);
          const result = await this.#store.acquire(parsed);

          this.#scheduleWake(result.wakeDoName);

          return Response.json(result.value);
        }
        case 'heartbeat': {
          const parsed = Schema.decodeUnknownSync(SlotHeartbeatInput)(input);
          const result = await this.#store.heartbeat(parsed);

          this.#scheduleWake(result.wakeDoName);

          return Response.json(result.value);
        }
        case 'release': {
          const parsed = Schema.decodeUnknownSync(SlotReleaseInput)(input);
          const result = await this.#store.release(parsed);

          this.#scheduleWake(result.wakeDoName);

          return Response.json(result.value);
        }
        case 'recoverInstance': {
          const parsed = Schema.decodeUnknownSync(SlotRecoverInput)(input);
          const result = await this.#store.recoverInstance(parsed);

          this.#scheduleWake(result.wakeDoName);

          return Response.json(result.value);
        }
        case 'cancel': {
          const parsed = Schema.decodeUnknownSync(SlotHolderInput)(input);
          const result = await this.#store.cancel(parsed);

          this.#scheduleWake(result.wakeDoName);

          return Response.json(result.value);
        }
        case 'remove': {
          const parsed = Schema.decodeUnknownSync(SlotHolderInput)(input);
          const result = await this.#store.remove(parsed);

          this.#scheduleWake(result.wakeDoName);

          return Response.json(result.value);
        }
        case 'epoch': {
          const parsed = Schema.decodeUnknownSync(SlotHolderInput)(input);
          const result = await this.#store.epoch(parsed);

          this.#scheduleWake(result.wakeDoName);

          return Response.json(result.value);
        }
        case 'attention': {
          const result = await this.#store.attention();

          this.#scheduleWake(result.wakeDoName);

          return Response.json(result.value);
        }
        default:
          return Response.json({ reason: 'Unknown agent slot operation' }, { status: HttpStatusCode.NotFound });
      }
    } catch (failure) {
      if (failure instanceof SlotRetiredError) {
        return Response.json({ reason: failure.message }, { status: HttpStatusCode.Conflict });
      }

      throw failure;
    }
  }

  override async alarm(): Promise<void> {
    const result = await this.#store.reapAlarm();

    this.#scheduleWake(result.wakeDoName);
  }
}
