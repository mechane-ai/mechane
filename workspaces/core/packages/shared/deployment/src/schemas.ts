import { Schema } from 'effect';
import { LimitPolicy, LOOPBACK_HOSTS, OriginProtocol, OUTPUT_MAX_TOKENS } from './constants.ts';

/**
 * An origin a credential may go to: an HTTPS URL, or a plain HTTP URL of a loopback host. Keys and cookies go to the
 * deployment's, and the client secret to GitHub's.
 */
export const SecureOrigin = Schema.URLFromString.check(
  Schema.makeFilter(
    (url) =>
      url.protocol === OriginProtocol.Secure ||
      (url.protocol === OriginProtocol.Loopback && LOOPBACK_HOSTS.has(url.hostname)),
    { expected: `an ${OriginProtocol.Secure} URL, or an ${OriginProtocol.Loopback} URL of this machine` },
  ),
);

export type SecureOrigin = typeof SecureOrigin.Type;

/** An origin of this machine over plain HTTP, such as a local stack's host launcher, which no remote Worker reaches. */
export const LoopbackOrigin = Schema.URLFromString.check(
  Schema.makeFilter((url) => url.protocol === OriginProtocol.Loopback && LOOPBACK_HOSTS.has(url.hostname), {
    expected: `an ${OriginProtocol.Loopback} URL of this machine`,
  }),
);

export type LoopbackOrigin = typeof LoopbackOrigin.Type;

/** The id of a model the deployment offers, which is also the model upstream's own id for it. */
export const ModelId = Schema.NonEmptyString;

export type ModelId = typeof ModelId.Type;

/** A whole count above zero, such as the tokens of a model's context window or the requests of a rate limit. */
const PositiveCount = Schema.Int.check(Schema.isGreaterThan(0));

/** The output tokens an offer gives a request: a whole count above zero, at most the deployment's bound. */
const OutputTokens = Schema.Int.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(OUTPUT_MAX_TOKENS));

/** A rate in micro-dollars per million tokens, which equals dollars per token, as a whole number. */
const MicrosPerMillionTokens = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/** A model the deployment sells: its id at the upstream, its limits, and its rates for each kind of token. */
export const ModelOffer = Schema.Struct({
  id: ModelId,
  contextWindowTokens: PositiveCount,
  maxOutputTokens: OutputTokens,
  inputMicrosPerMillionTokens: MicrosPerMillionTokens,
  outputMicrosPerMillionTokens: MicrosPerMillionTokens,
  cacheReadMicrosPerMillionTokens: MicrosPerMillionTokens,
  cacheWriteMicrosPerMillionTokens: MicrosPerMillionTokens,
}).pipe(
  Schema.encodeKeys({
    contextWindowTokens: 'context_window_tokens',
    maxOutputTokens: 'max_output_tokens',
    inputMicrosPerMillionTokens: 'input_micros_per_million_tokens',
    outputMicrosPerMillionTokens: 'output_micros_per_million_tokens',
    cacheReadMicrosPerMillionTokens: 'cache_read_micros_per_million_tokens',
    cacheWriteMicrosPerMillionTokens: 'cache_write_micros_per_million_tokens',
  }),
);

export type ModelOffer = typeof ModelOffer.Type;

/** The offers in order, each id once; a mech created without a model gets the first. */
const ModelOffers = Schema.NonEmptyArray(ModelOffer).check(
  Schema.makeFilter((offers) => new Set(offers.map((offer) => offer.id)).size === offers.length, {
    expected: 'offers with distinct ids',
  }),
);

/** The offers as the deployment's one variable writes them: their JSON. */
export const ModelOffersVariable = Schema.fromJsonString(ModelOffers);

export type ModelOffersVariable = typeof ModelOffersVariable.Type;

/** How many requests a rate limit policy allows in each of its fixed windows. */
export const RateLimit = Schema.Struct({ requests: PositiveCount, windowSeconds: PositiveCount }).pipe(
  Schema.encodeKeys({ windowSeconds: 'window_seconds' }),
);

export type RateLimit = typeof RateLimit.Type;

/** Every policy's limit, as the deployment's one variable writes them: their JSON, keyed by policy. */
export const RateLimitsVariable = Schema.fromJsonString(
  Schema.Struct({
    [LimitPolicy.Address]: RateLimit,
    [LimitPolicy.DeviceStart]: RateLimit,
    [LimitPolicy.Principal]: RateLimit,
    [LimitPolicy.CodeAttempt]: RateLimit,
  }),
);

export type RateLimitsVariable = typeof RateLimitsVariable.Type;

/** How many machines one workspace's sandboxes may run at once, as a variable writes it. */
export const MachinesVariable = Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThan(0));

export type MachinesVariable = typeof MachinesVariable.Type;
