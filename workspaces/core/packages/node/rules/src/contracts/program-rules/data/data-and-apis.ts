import { AST_GREP_DEFAULTS, OXLINT_DEFAULTS, RolloutPhase, RuleFix, RuleStatus, Severity } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';
import { Option } from 'effect';

/** What enforces `data-and-apis`: absence spelled as `Option`, and store outcomes answered as tagged values. */
export const dataAndApis = {
  values: {},
  rules: [
    {
      ...AST_GREP_DEFAULTS,
      name: 'no-optional-property',
      standard: 'TD-18',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
      violation: ['type Mech = { readonly name?: string };'],
      allowed: ['type Mech = { readonly name: Option.Option<string> };'],
    },
    {
      ...OXLINT_DEFAULTS,
      name: 'unicorn/no-useless-undefined',
      fix: RuleFix.Oxlint,
      value: [Severity.Error, { checkArguments: false, checkArrowFunctionBody: false }],
      note: Option.some(
        'An outbound call keeps its `.then` with both handlers, such as `.then(() => undefined, onRejected)`.',
      ),
      standard: 'TD-18',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'nullable-type',
      standard: 'TD-18',
      status: RuleStatus.Ratchet,
      phase: RolloutPhase.DataShapes,
      violation: ['type Row = { readonly endedAt: number | null };', 'const Row = Schema.NullOr(Schema.Number);'],
      allowed: [
        'type Row = { readonly endedAt: Option.Option<number> };',
        'type Rows = ReadonlyMap<string, undefined>;',
      ],
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'nullish-comparison',
      standard: 'TD-18',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.DataShapes,
      violation: ['if (value === null) { stop(); }', 'if (value !== undefined) { stop(); }'],
      allowed: ['if (Option.isNone(Option.fromNullishOr(value))) { stop(); }'],
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'nullish-operator',
      standard: 'TD-18',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.DataShapes,
      violation: ['const name = value ?? fallback;', 'const name = row?.name;'],
      allowed: ['const name = Option.getOrElse(Option.fromNullishOr(value), () => fallback);'],
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'store-boolean-answer',
      standard: 'TD-17',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.DataShapes,
      violation: ['function endTurn({ turnId }: EndInput): boolean { return true; }'],
      allowed: ['function endTurn({ turnId }: EndInput): TurnEnd { return TurnEnd.cases.Ended.make({ turnId }); }'],
    },
  ],
} as const satisfies ContractEnforcement;
