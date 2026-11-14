import { TurnToolCall } from '@mechane/protocol';
import { Schema } from 'effect';
import { EvalManifest, EvalSuiteDefinition, Observation } from '../application-schemas.ts';
import type { Json } from '../application-types.ts';
import { jsonDigest } from '../json-digest.ts';

type EncodeSuiteDefinitionInput = { readonly definition: EvalSuiteDefinition };
type DigestManifestInput = { readonly manifest: Pick<EvalManifest, 'version' | 'definition' | 'target'> };
type EncodeRoleToolCallsInput = { readonly toolCalls: ReadonlyArray<TurnToolCall> };
type EncodeObservationInput = { readonly observation: Observation };

const ManifestIdentity = Schema.Struct({
  version: EvalManifest.fields.version,
  definition: EvalManifest.fields.definition,
  target: EvalManifest.fields.target,
});

const RoleToolCalls = Schema.Array(TurnToolCall);

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

/** Protocol codecs remove native DateTime and Option representations from saved JSON evidence. */
export function encodeRoleToolCalls({ toolCalls }: EncodeRoleToolCallsInput): ReadonlyArray<Json> {
  const encode = Schema.encodeSync(RoleToolCalls);

  return encode(toolCalls);
}

/** Request bounds measure the same encoded bytes that the observation journal saves. */
export function encodeObservation({ observation }: EncodeObservationInput): typeof Observation.Encoded {
  const encode = Schema.encodeSync(Observation);

  return encode(observation);
}
