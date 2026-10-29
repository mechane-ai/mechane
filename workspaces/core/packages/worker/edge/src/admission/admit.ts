import { limitRequest } from '@mechane/bindings';
import type { WorkerSettings } from '@mechane/bindings';
import { LimitPolicy } from '@mechane/deployment';
import { Access } from '@mechane/protocol';
import type { AccessFailure, ObjectUnavailable, RateLimited } from '@mechane/protocol';
import { Effect } from 'effect';
import type { AccessCaller, Caller, RawPathParams } from '../types.ts';
import { resolveCaller } from './resolve-caller.ts';
import { resolveMember } from './resolve-member.ts';
import type { AdmitInput } from './types.ts';

/** A caller admission resolves, which fails as `E`, and the settings that name its principal's limiter. */
type LimitedCallerInput<E> = { readonly settings: WorkerSettings; readonly caller: Effect.Effect<Caller, E> };

type AdmitAccessInput<A extends Access> = {
  readonly access: A;
  readonly request: Request;
  readonly params: RawPathParams;
  readonly settings: WorkerSettings;
};

/**
 * The admission of each access, which the router runs before it decodes any input; it fails only with the failures the
 * protocol declares for the access, which a client expects.
 */
type Admissions = {
  readonly [A in Access]: (input: AdmitInput) => Effect.Effect<AccessCaller[A], AccessFailure<A>>;
};

/** The admission of each access; an access without one fails to compile. */
const ADMISSIONS: Readonly<Admissions> = {
  [Access.Public]: () => Effect.succeedNone,
  [Access.Principal]: ({ request, params, settings }) =>
    limitedCaller({ settings, caller: resolveCaller({ request, params, settings }) }),
  [Access.Member]: ({ request, params, settings }) =>
    limitedCaller({ settings, caller: resolveMember({ request, params, settings }) }),
};

/**
 * Admits a request by its operation's access, before the router decodes any input, and answers with its caller. Its
 * type parameter binds the operation's own access, which the router's call would widen to its constraint if inlined.
 */
export const admit = Effect.fn('admit')(function* <A extends Access>({
  access,
  request,
  params,
  settings,
}: AdmitAccessInput<A>): Effect.fn.Return<AccessCaller[A], AccessFailure<A>> {
  return yield* ADMISSIONS[access]({ request, params, settings });
});

/** An admitted caller, once its principal's limiter took the request, so one principal's keys share one limit. */
const limitedCaller = Effect.fn('limitedCaller')(function* <E>({
  settings,
  caller,
}: LimitedCallerInput<E>): Effect.fn.Return<Caller, E | RateLimited | ObjectUnavailable> {
  const admitted = yield* caller;

  yield* limitRequest({ settings, policy: LimitPolicy.Principal, countedBy: admitted.principal.id });

  return admitted;
});
