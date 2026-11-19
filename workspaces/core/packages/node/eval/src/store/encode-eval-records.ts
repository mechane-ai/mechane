import { Schema } from 'effect';
import { EvalManifest, EvalSuiteDefinition, Observation } from '../application-schemas.ts';
import { jsonDigest } from '../json-digest.ts';

type EncodeSuiteDefinitionInput = { readonly definition: EvalSuiteDefinition };
type DigestManifestInput = { readonly manifest: Pick<EvalManifest, 'version' | 'definition' | 'target'> };
type EncodeObservationInput = { readonly observation: Observation };

const ManifestIdentity = Schema.Struct({
  version: EvalManifest.fields.version,
  definition: EvalManifest.fields.definition,
  target: EvalManifest.fields.target,
});

/** Public suite configuration keeps the codec's wire names and measured units. */
export function encodeSuiteDefinition({ definition }: EncodeSuiteDefinitionInput): typeof EvalSuiteDefinition.Encoded {
  const encode = Schema.encodeSync(EvalSuiteDefinition);

  return encode(definition);
}

/** Start time and trial projections do not change the frozen experiment identity. */
export function digestManifest({ manifest }: DigestManifestInput): string {
  const encoded = Schema.encodeSync(ManifestIdentity)(manifest);

  return jsonDigest({ value: encoded });
}

/** Request bounds measure the same encoded bytes that the observation journal saves. */
export function encodeObservation({ observation }: EncodeObservationInput): typeof Observation.Encoded {
  const encode = Schema.encodeSync(Observation);

  return encode(observation);
}
