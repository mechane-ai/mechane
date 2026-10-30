import { ModelOffersVariable, SecureOrigin, WORKER_VARIABLES } from '@mechane/deployment';
import { Duration, Schema } from 'effect';
import { ALARM_WORK_MAX } from './constants.ts';
import { SecretSource } from './secrets/secret-source.schemas.ts';

/** How long one alarm lets pi work as a variable writes it: whole seconds above zero, at most the declared maximum. */
const AlarmWorkSeconds = Schema.NumberFromString.check(
  Schema.isInt(),
  Schema.isGreaterThan(0),
  Schema.isLessThanOrEqualTo(Duration.toSeconds(ALARM_WORK_MAX)),
);

/**
 * The variables a mech's object reads: its model's upstream, key and offers, its workspace's sandboxes, machine quota
 * and suspension, and how long one alarm lets pi work. The key comes from the deployment's secret store, stays redacted
 * and goes only to the upstream, so the upstream's URL is HTTPS outside a loopback stack.
 */
export const MechVariables = Schema.Struct({
  githubWebOrigin: SecureOrigin,
  githubApiOrigin: SecureOrigin,
  modelUpstream: SecureOrigin,
  modelApiKey: SecretSource,
  credentialKeyring: SecretSource,
  modelOffers: ModelOffersVariable,
  alarmWorkSeconds: AlarmWorkSeconds,
}).pipe(Schema.encodeKeys(WORKER_VARIABLES));

export type MechVariables = typeof MechVariables.Type;

/** A limiter's answer to a take: the request fits its window, or the window is full until `retryAfterSeconds`. */
export const TakeAnswer = Schema.TaggedUnion({ Allowed: {}, Limited: { retryAfterSeconds: Schema.Int } });

export type TakeAnswer = typeof TakeAnswer.Type;
