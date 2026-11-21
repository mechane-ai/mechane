import { HttpStatusCode } from '@mechane/records';
import { Predicate, Schema } from 'effect';
import { failManagedRequest } from './failure.ts';
import { resolveManagedModel } from './managed-offers.ts';
import { ManagedEffort } from './model-effort.ts';
import type { ManagedModelOptions } from './model-effort.ts';
import type { ModelOffer } from './offers.ts';

const Speed = Schema.Literals(['standard', 'fast']);
const Effort = Schema.Struct({ type: ManagedEffort });

const ModelInput = Schema.Struct({
  id: Schema.NonEmptyString,
  speed: Schema.optionalKey(Schema.NullOr(Speed)),
  effort: Schema.optionalKey(Schema.NullOr(Schema.Union([ManagedEffort, Effort]))),
  inference_geo: Schema.optionalKey(Schema.NullOr(Schema.String)),
});

const PinnedModel = Schema.Struct({
  id: Schema.NonEmptyString,
  speed: Schema.optionalKey(Speed),
  effort: Schema.optionalKey(Effort),
});

type ModelSettings = { readonly id: string; readonly speed: typeof Speed.Type; readonly effort?: typeof Effort.Type };
type ResolveSettings = { readonly offers: ReadonlyArray<ModelOffer>; readonly value: unknown };

function modelInput(value: unknown): typeof ModelInput.Type {
  if (typeof value === 'string' && value.length > 0) {
    return { id: value };
  }

  if (!Schema.is(ModelInput)(value)) {
    return failManagedRequest(HttpStatusCode.BadRequest, 'Invalid model configuration');
  }

  return value;
}

function requestedEffort(effort: typeof ModelInput.Type.effort): ManagedEffort | undefined {
  if (typeof effort === 'string') {
    return effort;
  }

  return effort?.type;
}

export function managedModelSettings({ offers, value }: ResolveSettings): ModelSettings {
  const input = modelInput(value);
  const offer = resolveManagedModel(offers, input.id);

  if (offer === undefined) {
    return failManagedRequest(HttpStatusCode.BadRequest, 'The requested model is unavailable on this installation');
  }

  if (Predicate.isNotNullish(input.inference_geo)) {
    return failManagedRequest(HttpStatusCode.BadRequest, 'This gateway does not support inference_geo');
  }

  const speed = input.speed ?? 'standard';

  const effort = requestedEffort(input.effort) ?? offer.defaultEffort;

  assertManagedModelOptions(offer, { speed, effort });

  if (effort === undefined) {
    return { id: input.id, speed };
  }

  return { id: input.id, speed, effort: { type: effort } };
}

export function assertManagedModelOptions(offer: ModelOffer, options: ManagedModelOptions): void {
  if (options.speed === 'fast' && (offer.protocol !== 'anthropic-messages' || offer.fastPricing === undefined)) {
    failManagedRequest(HttpStatusCode.BadRequest, 'The requested model does not support fast mode on this gateway');
  }

  if (options.effort !== undefined && offer.efforts?.includes(options.effort) !== true) {
    failManagedRequest(HttpStatusCode.BadRequest, 'The requested model does not support this effort on this gateway');
  }
}

type PinnedSettingsInput = { readonly value: unknown; readonly expectedId: string };

export function pinnedModelSettings({ value, expectedId }: PinnedSettingsInput) {
  if (!Schema.is(PinnedModel)(value) || value.id !== expectedId) {
    return failManagedRequest(HttpStatusCode.Conflict, 'The session has an inconsistent pinned model configuration');
  }

  return { speed: value.speed ?? 'standard', effort: value.effort?.type ?? null };
}
