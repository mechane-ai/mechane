import { AST_GREP_DEFAULTS, RolloutPhase, RuleFix, RuleStatus } from '@mechane/rule-shapes';

/** The rules that make each `Effect.all` and `Effect.forEach` state its concurrency (EF-10). */
export const CONCURRENCY_RULES = [
  {
    ...AST_GREP_DEFAULTS,
    name: 'all-concurrency',
    fix: RuleFix.AstGrep,
    standard: 'EF-10',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.Fixers,
    violation: ['Effect.all([readTurn, readMech]);'],
    allowed: ['Effect.all([readTurn, readMech], { concurrency: 1 });'],
    fixed: ['Effect.all([readTurn, readMech], { concurrency: 1 });'],
  },
  {
    ...AST_GREP_DEFAULTS,
    name: 'all-options-concurrency',
    fix: RuleFix.AstGrep,
    standard: 'EF-10',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.Baselines,
    violation: ['Effect.all(effects, { discard: true });', 'Effect.all(effects, { discard: true, });'],
    allowed: ['Effect.all(effects, { discard: true, concurrency: 1 });'],
    fixed: [
      'Effect.all(effects, { discard: true, concurrency: 1 });',
      'Effect.all(effects, { discard: true, concurrency: 1 });',
    ],
  },
  {
    ...AST_GREP_DEFAULTS,
    name: 'for-each-concurrency',
    fix: RuleFix.AstGrep,
    standard: 'EF-10',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.Fixers,
    violation: ['Effect.forEach(paths, readFile);'],
    allowed: ['Effect.forEach(paths, readFile, { concurrency: 1 });'],
    fixed: ['Effect.forEach(paths, readFile, { concurrency: 1 });'],
  },
  {
    ...AST_GREP_DEFAULTS,
    name: 'for-each-options-concurrency',
    fix: RuleFix.AstGrep,
    standard: 'EF-10',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.Fixers,
    violation: [
      'Effect.forEach(paths, readFile, { discard: true });',
      'Effect.forEach(paths, readFile, { discard: true, });',
    ],
    allowed: ['Effect.forEach(paths, readFile, { discard: true, concurrency: 1 });'],
    fixed: [
      'Effect.forEach(paths, readFile, { discard: true, concurrency: 1 });',
      'Effect.forEach(paths, readFile, { discard: true, concurrency: 1 });',
    ],
  },
] as const;
