import {
  AST_GREP_DEFAULTS,
  FixBehavior,
  Lane,
  RESTRICTED_DEFAULTS,
  RolloutPhase,
  RuleFix,
  RuleStatus,
} from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';
import { BOUNDARY_SCHEMA_RULES } from './boundary-schema-rules.ts';

/**
 * The declarations whose `json()` each lane's strict globals make return `unknown`, as each lane's types name them;
 * `JSON.parse` returns `unknown` in every lane. A Worker's `Body` is a class that no declaration can change.
 */
const VALUES = {
  jsonBodies: {
    [Lane.Shared]: ['Body'],
    [Lane.Worker]: ['Response', 'Request<CfHostMetadata = unknown, Cf = CfProperties<CfHostMetadata>>', 'R2ObjectBody'],
    [Lane.Node]: [],
  },
} as const;

/**
 * What enforces `code-typescript-effect-schemas`: each boundary decodes with its one verb and encodes one way, and each
 * schema names its type.
 */
export const codeTypescriptEffectSchemas = {
  values: VALUES,
  rules: [
    {
      ...RESTRICTED_DEFAULTS,
      message: 'Decode a boundary with its one verb, such as `Schema.decodeUnknownEffect(Settings)(input)`',
      properties: { Schema: ['decodeUnknownOption'] },
      imports: [],
      exemptRoles: [],
      standard: 'TD-22',
      status: RuleStatus.Ratchet,
      phase: RolloutPhase.DataShapes,
    },
    {
      ...RESTRICTED_DEFAULTS,
      message: "Encode the code's own output with `Schema.encodeSync`, such as `Schema.encodeSync(Row)(row)`",
      properties: { Schema: ['encodeEffect', 'encodeUnknownEffect'] },
      imports: [],
      exemptRoles: [],
      standard: 'EF-16',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'decode-or-die',
      standard: 'EF-16',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
      violation: [
        'const row = yield* Schema.decodeUnknownEffect(Row)(input).pipe(Effect.orDie);',
        'const row = yield* Effect.orDie(Schema.decodeUnknownEffect(Row)(input));',
      ],
      allowed: ['const row = yield* Schema.decodeUnknownEffect(Row)(input).pipe(Effect.mapError(toFailed));'],
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'schema-alias',
      fix: RuleFix.AstGrep,
      behavior: FixBehavior.TypeOnly,
      standard: 'TD-12',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
      violation: ['export const Turn = Schema.Struct({ id: Schema.String });'],
      allowed: [
        'export const Turn = Schema.Struct({ id: Schema.String }); export type Turn = typeof Turn.Type;',
        'export const MemoryReadParameters = Type.Object({ path: Type.String() });',
      ],
      fixed: ['export const Turn = Schema.Struct({ id: Schema.String });\n\nexport type Turn = typeof Turn.Type;'],
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'encode-sync',
      fix: RuleFix.AstGrep,
      standard: 'EF-16',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
      violation: ['const text = yield* Schema.encodeEffect(SecretsFile)(secrets).pipe(Effect.orDie);'],
      allowed: ['const text = Schema.encodeSync(SecretsFile)(secrets);'],
      fixed: ['const text = Schema.encodeSync(SecretsFile)(secrets);'],
    },
    ...BOUNDARY_SCHEMA_RULES,
    {
      ...AST_GREP_DEFAULTS,
      name: 'json-type-argument',
      behavior: FixBehavior.TypeOnly,
      standard: 'TD-11',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Registry,
      violation: ['const row = await response.json<Row>();'],
      allowed: ['const row = Schema.decodeUnknownEffect(Row)(await response.json());'],
    },
  ],
} as const satisfies ContractEnforcement;
