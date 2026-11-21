import { Schema } from 'effect';
import type { GatewayCredentials } from './gateway-credential-settings.ts';
import { ManagedEffort } from './model-effort.ts';

const PositiveInteger = Schema.Int.check(Schema.isGreaterThan(0));
const NonnegativeInteger = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

const TokenRates = Schema.Struct({
  inputMicrosPerMillionTokens: NonnegativeInteger,
  outputMicrosPerMillionTokens: NonnegativeInteger,
  cacheReadMicrosPerMillionTokens: NonnegativeInteger,
  cacheWriteMicrosPerMillionTokens: NonnegativeInteger,
  cacheWriteOneHourMicrosPerMillionTokens: Schema.optionalKey(NonnegativeInteger),
});

const PricedOffer = Schema.Struct({ ...TokenRates.fields, listPrice: Schema.optionalKey(TokenRates) });

const ModelOfferSchema = Schema.Struct({
  ...PricedOffer.fields,
  id: Schema.NonEmptyString,
  aliases: Schema.optionalKey(Schema.Array(Schema.NonEmptyString)),
  contextWindowTokens: PositiveInteger,
  maxOutputTokens: PositiveInteger,
  supportsImages: Schema.optionalKey(Schema.Boolean),
  protocol: Schema.optionalKey(Schema.Literals(['openai-completions', 'anthropic-messages'])),
  efforts: Schema.optionalKey(Schema.NonEmptyArray(ManagedEffort)),
  defaultEffort: Schema.optionalKey(ManagedEffort),
  fastPricing: Schema.optionalKey(PricedOffer),
}).check(
  Schema.makeFilter(
    (offer) => offer.defaultEffort === undefined || offer.efforts?.includes(offer.defaultEffort) === true,
  ),
  Schema.makeFilter((offer) => offer.fastPricing === undefined || offer.protocol === 'anthropic-messages'),
);

export const OffersSchema = Schema.NonEmptyArray(ModelOfferSchema);
export type ModelOffer = typeof ModelOfferSchema.Type;

export type ModelGatewayConfiguration = {
  readonly model: {
    readonly upstreamUrl: string;
    readonly credentials: GatewayCredentials;
    readonly offers: ReadonlyArray<ModelOffer>;
  };
};

export const ManagedWireObject = Schema.Record(Schema.String, Schema.Unknown);
export type ManagedWireObject = typeof ManagedWireObject.Type;

export function assertDistinctModelIdentifiers(offers: ReadonlyArray<ModelOffer>): void {
  const modelIds = new Set(offers.map((offer) => offer.id));

  if (modelIds.size !== offers.length) {
    throw new Error('Model offers must have distinct IDs');
  }

  const allIdentifiers = offers.flatMap((offer) => [offer.id, ...(offer.aliases ?? [])]);

  if (new Set(allIdentifiers).size !== allIdentifiers.length) {
    throw new Error('Model offer aliases must be distinct from all model IDs and aliases');
  }
}
