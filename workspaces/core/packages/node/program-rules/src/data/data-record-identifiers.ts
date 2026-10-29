import { ADOPTED, AST_GREP_DEFAULTS, FixBehavior, RolloutPhase, RuleStatus } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** What enforces `data-record-identifiers`: every id made and typed through its entity's brand, and named once. */
export const dataRecordIdentifiers = {
  values: {},
  rules: [
    {
      ...AST_GREP_DEFAULTS,
      name: 'bare-random-uuid',
      standard: 'TD-14',
      status: RuleStatus.Ratchet,
      phase: RolloutPhase.DataShapes,
      violation: ['const turnId = crypto.randomUUID();'],
      allowed: ['const turnId = TurnId.make(crypto.randomUUID());'],
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'object-name-outside-object-calls',
      standard: '044',
      violation: ['const id = namespace.idFromName(name);'],
      allowed: ['const name = mechObjectName({ mechId });'],
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'plain-id-schema',
      standard: 'TD-14',
      status: RuleStatus.Ratchet,
      phase: RolloutPhase.DataShapes,
      violation: ['const Row = Schema.Struct({ turnId: Schema.String });'],
      allowed: ['const Row = Schema.Struct({ turnId: TurnId });'],
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'plain-id-type',
      behavior: FixBehavior.TypeOnly,
      standard: 'TD-14',
      status: RuleStatus.Ratchet,
      phase: RolloutPhase.DataShapes,
      violation: ['type Row = { readonly turnId: string };'],
      allowed: ['type Row = { readonly turnId: TurnId };'],
    },
  ],
} as const satisfies ContractEnforcement;
