import {
  ADOPTED,
  AST_GREP_DEFAULTS,
  FixBehavior,
  OWNED_DEFAULTS,
  OXLINT_DEFAULTS,
  RolloutPhase,
  RuleStatus,
  Severity,
} from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';
import OXLINT_OPT_OUTS from './oxlint-opt-outs.json' with { type: 'json' };

/**
 * How oxlint runs: its plugins, every rule of its six categories at error but those the opt-out list turns off, its
 * options, and the folders it skips. The list holds each rule that still has findings, which `rules:measure` prints and
 * a sweep turns on, and each rule off by decision, with its reason. No rule's budget allows more than three
 * suppressions.
 */
const VALUES = {
  oxlint: {
    plugins: ['typescript', 'unicorn', 'oxc', 'import', 'node', 'jsdoc', 'promise'],
    categories: ['correctness', 'suspicious', 'pedantic', 'perf', 'style', 'restriction'],
    options: { typeAware: true, reportUnusedDisableDirectives: Severity.Error },
    // Copied license text uses legal comments for bundler retention and contains no implementation code.
    ignorePatterns: ['**/dist/**', '**/node_modules/**', 'lint/types/**', 'licenses/*.js'],
    optOuts: OXLINT_OPT_OUTS,
  },
  maxRuleSuppressions: 3,
} as const;

/** What enforces `code-lint-suppressions`: how oxlint runs, and each directive names its rule and a reason. */
export const codeLintSuppressions = {
  values: VALUES,
  rules: [
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'unicorn/no-abusive-eslint-disable',
      value: Severity.Error,
      standard: 'AS-02',
    },
    {
      ...OWNED_DEFAULTS,
      name: 'baselines',
      standard: 'AS-05',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Baselines,
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'suppression-form',
      behavior: FixBehavior.TypeOnly,
      standard: 'AS-02',
      violation: ['// oxlint-disable max-params', '// eslint-disable-next-line max-params'],
      allowed: ['// oxlint-disable-next-line max-params -- the runtime passes four'],
    },
  ],
} as const satisfies ContractEnforcement;
