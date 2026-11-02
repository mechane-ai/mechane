import { AST_GREP_DEFAULTS, RolloutPhase, RuleStatus } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Locked migrations must stay self-contained even when ordinary operations are reorganized. */
export const codeFunctionSize = {
  values: {},
  rules: [
    {
      ...AST_GREP_DEFAULTS,
      name: 'migrations-statements',
      standard: 'ST-22',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.NameFreeze,
      violation: ['function stepCount() { return 1; }', 'export const STEP_COUNT = 1;'],
      allowed: [
        "import type { Migration } from '../../store/index.ts';",
        "export const MIGRATIONS: ReadonlyArray<Migration> = [({ sql }) => { sql.exec('CREATE TABLE t (id TEXT) STRICT'); }];",
      ],
    },
  ],
} as const satisfies ContractEnforcement;
