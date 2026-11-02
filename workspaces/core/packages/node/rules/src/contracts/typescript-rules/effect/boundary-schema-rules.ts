import { AST_GREP_DEFAULTS, RolloutPhase, RuleStatus } from '@mechane/rule-shapes';

/**
 * The rules of `code-typescript-effect-schemas` at a wire, RPC or stored boundary: keys spelled once in `records`, rows
 * decoded by their store's kernel, and every text bounded.
 */
export const BOUNDARY_SCHEMA_RULES = [
  {
    ...AST_GREP_DEFAULTS,
    name: 'encode-keys-outside-records',
    standard: 'CP-06',
    status: RuleStatus.Ratchet,
    phase: RolloutPhase.DataShapes,
    violation: ["const Row = Schema.Struct({ mechId: RecordId }).pipe(Schema.encodeKeys({ mechId: 'mech_id' }));"],
    allowed: ['const Row = wireStruct({ fields: { mechId: RecordId } });'],
  },
  {
    ...AST_GREP_DEFAULTS,
    name: 'store-row-decode',
    standard: 'TD-22',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.DataShapes,
    violation: ['const row = Schema.decodeUnknownSync(TurnRow)(value);'],
    allowed: ['const rows = decodeRows({ cursor, schema: TurnRow });'],
  },
  {
    ...AST_GREP_DEFAULTS,
    name: 'bare-string-schema',
    standard: 'TD-26',
    status: RuleStatus.Ratchet,
    phase: RolloutPhase.DataShapes,
    violation: ['const Thread = Schema.Struct({ title: Schema.String });'],
    allowed: [
      'const Thread = Schema.Struct({ title: boundedText({ maxBytes: TITLE_MAX_BYTES }) });',
      'const Digest = Schema.String.check(Schema.isPattern(SHA256_PATTERN));',
      "class RequestInvalid extends Schema.TaggedError<RequestInvalid>()('RequestInvalid', { reason: Schema.String }) {}",
      'const Binaries = Schema.Record(Schema.String, ReleaseBinary);',
      'const Secret = Schema.RedactedFromValue(Schema.String);',
    ],
  },
] as const;
