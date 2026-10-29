import type { LimitPolicy, RateLimit } from '@mechane/deployment';
import type { TakeAnswer } from './schemas.ts';

/** Each RPC method of a limiter. */
type LimiterMethods = {
  /** The count of schema migrations the limiter's database has applied. */
  readonly schemaRevision: () => number;
  /** Counts one request against the policy's window, or refuses it until the full window ends. */
  readonly take: (input: TakeInput) => typeof TakeAnswer.Encoded;
};

/**
 * The methods a limiter serves by RPC, each answering with plain data the Worker decodes. The bindings name the object
 * by this type, so they need not import the object.
 */
export type LimiterRpc = Rpc.DurableObjectBranded & LimiterMethods;

/** One request of a policy, with the limit the deployment gives that policy now. */
export type TakeInput = { readonly policy: LimitPolicy; readonly limit: RateLimit };
