import { openLimiterStore } from '@mechane/limiter-store';
import type { LimiterStore } from '@mechane/limiter-store';
import type { LimiterRpc, TakeAnswer, TakeInput } from '@mechane/rpc';
import { DurableObject } from 'cloudflare:workers';
import { DateTime } from 'effect';
import { decideTake } from './windows/decide-take.ts';

/**
 * The limiter of one address, principal or GitHub user: each policy's current window, stored, so neither an eviction
 * nor a deploy forgives a client.
 */
export class LimiterObject extends DurableObject<unknown> implements LimiterRpc {
  readonly #store: LimiterStore;

  constructor(state: DurableObjectState, environment: unknown) {
    super(state, environment);

    this.#store = openLimiterStore({ storage: state.storage });
  }

  /** The count of schema migrations the limiter's database has applied. */
  schemaRevision(): number {
    return this.#store.schemaRevision();
  }

  /** Counts one request against the policy's window, or refuses it until the full window ends. */
  take({ policy, limit }: TakeInput): typeof TakeAnswer.Encoded {
    return decideTake({ store: this.#store, policy, limit, now: DateTime.nowUnsafe() });
  }
}
