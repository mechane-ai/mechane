import {
  AST_GREP_DEFAULTS,
  FileRole,
  OXLINT_DEFAULTS,
  RolloutPhase,
  RuleFix,
  RuleStatus,
  Severity,
} from '@mechane/rule-shapes';

/** The rollout of an async-shell rule (DO-03), held to its baseline until its phase. */
const ASYNC_SHELL = { ...OXLINT_DEFAULTS, standard: 'DO-03', status: RuleStatus.Ratchet } as const;

/**
 * The rules of the object dialect's async shell (DO-03), which the standard gives local contract 104; until that
 * contract lands, `code-execution-lifecycle` holds them.
 */
export const ASYNC_SHELL_RULES = [
  {
    ...ASYNC_SHELL,
    name: 'typescript/promise-function-async',
    status: RuleStatus.Enforced,
    fix: RuleFix.Oxlint,
    value: [Severity.Error, { checkArrowFunctions: false }],
    phase: RolloutPhase.ObjectDialect,
  },
  {
    ...ASYNC_SHELL,
    name: 'typescript/return-await',
    status: RuleStatus.Enforced,
    fix: RuleFix.Oxlint,
    value: [Severity.Error, 'always'],
    phase: RolloutPhase.Fixers,
  },
  {
    ...OXLINT_DEFAULTS,
    name: 'promise/avoid-new',
    value: Severity.Error,
    exemptRoles: [FileRole.Utilities],
    standard: 'DO-03',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.Fixers,
  },
  {
    ...OXLINT_DEFAULTS,
    name: 'promise/always-return',
    value: [Severity.Error, { ignoreLastCallback: true }],
    standard: 'DO-03',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.Fixers,
  },
  {
    ...AST_GREP_DEFAULTS,
    name: 'promise-chain',
    standard: 'DO-03',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.ObjectDialect,
    violation: ['p.finally(f);', 'p.catch(f);', 'p.then(f).then(g);', 'new Promise(f);', 'Promise.resolve(1);'],
    allowed: ['async function use() { return read(await call()); }', 'Effect.catch(stop);'],
  },
  {
    ...AST_GREP_DEFAULTS,
    name: 'promise-building',
    standard: 'DO-05',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.ObjectDialect,
    violation: [
      'const { promise, resolve } = Promise.withResolvers<void>();',
      'const answer = await Promise.race([asked, aborted]);',
      'const timer = setTimeout(wake, WAKE_MS);',
      'await settling.then(close, close);',
      'await call().then(read);',
    ],
    allowed: [
      'const answer = await unlessStopped({ promise: asked, stop: aborted });',
      'const isHealthy = await probe().then(isAnswered, () => false);',
    ],
  },
] as const;
