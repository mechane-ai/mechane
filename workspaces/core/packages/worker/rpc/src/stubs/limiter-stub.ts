import { LimitPolicy } from '@mechane/deployment';
import type { LimiterRpc } from '../limits.types.ts';
import type { ObjectBindings } from '../types.ts';
import { limiterObjectName } from './limiter-object-name.ts';

type LimiterStubInput = { readonly bindings: ObjectBindings; readonly policy: LimitPolicy; readonly countedBy: string };

/** What a limiter counts the requests of: a client's address, a principal, or a GitHub user. */
const LimiterKind = { Address: 'address', Principal: 'principal', GitHub: 'github' } as const;

type LimiterKind = (typeof LimiterKind)[keyof typeof LimiterKind];

/** The kind of limiter each policy counts in, so one limiter holds the windows of every policy of its kind. */
const POLICY_LIMITER: Readonly<Record<LimitPolicy, LimiterKind>> = {
  [LimitPolicy.Address]: LimiterKind.Address,
  [LimitPolicy.DeviceStart]: LimiterKind.Address,
  [LimitPolicy.Principal]: LimiterKind.Principal,
  [LimitPolicy.CodeAttempt]: LimiterKind.GitHub,
};

/** The stub of the limiter a policy counts in: one object per address, principal or GitHub user. */
export function limiterStub({ bindings, policy, countedBy }: LimiterStubInput): DurableObjectStub<LimiterRpc> {
  const name = limiterObjectName({ kind: POLICY_LIMITER[policy], countedBy });

  return bindings.limiters.get(bindings.limiters.idFromName(name));
}
