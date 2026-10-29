import {
  AST_GREP_DEFAULTS,
  InstalledAsset,
  OXLINT_DEFAULTS,
  RolloutPhase,
  RuleFix,
  RuleStatus,
  Severity,
} from '@mechane/rule-shapes';

/** Error settings retain direct promise callbacks at the Effect boundary. */
const OXLINT_ERROR_RULE = {
  ...OXLINT_DEFAULTS,
  standard: 'ER-04',
  status: RuleStatus.Enforced,
  phase: RolloutPhase.EffectDialect,
} as const;

/** A rule of the ast-grep folder `code-typescript-effect-errors` ships, enforced in the Effect dialect's phase. */
const AST_GREP_ASSET = {
  ...AST_GREP_DEFAULTS,
  asset: InstalledAsset.AstGrepRules,
  standard: 'ER-04',
  status: RuleStatus.Enforced,
  phase: RolloutPhase.EffectDialect,
} as const;

/** The error rules retain the Effect dialect's promise settings and load the shipped syntax checks in place. */
export const INSTALLED_ERROR_RULES = [
  {
    ...OXLINT_ERROR_RULE,
    name: 'no-throw-literal',
    value: Severity.Error,
    violation: ["throw 'the file is missing';"],
    allowed: ['throw new FileUnreadable({ path });'],
  },
  {
    ...OXLINT_ERROR_RULE,
    name: 'preserve-caught-error',
    value: Severity.Error,
    fix: RuleFix.Oxlint,
    violation: ["try { read(); } catch (cause) { throw new Error('the read failed'); }"],
    allowed: ['try { read(); } catch (cause) { throw new ReadFailed({ reason: String(cause) }); }'],
  },
  { ...OXLINT_ERROR_RULE, name: 'unicorn/throw-new-error', value: Severity.Off, fix: RuleFix.Oxlint },
  {
    ...AST_GREP_ASSET,
    name: 'untagged-errors-typescript',
    violation: ["const failure = new Error('x');", "Effect.dieMessage('the row is missing');"],
    allowed: ['const failure = new FileUnreadable({ path });'],
  },
  {
    ...AST_GREP_ASSET,
    name: 'catch-handlers-typescript',
    violation: ['promise.catch(() => {});', 'try { read(); } catch { stop(); }'],
    allowed: [
      'Effect.tryPromise({ try: () => open(path), catch: (cause) => new Unreadable({ path, reason: String(cause) }) });',
    ],
  },
  {
    ...AST_GREP_ASSET,
    name: 'promise-chains-typescript',
    status: RuleStatus.Ratchet,
    violation: ['promise.then(read);', 'promise.finally(close);'],
    allowed: ['const result = await promise;'],
  },
] as const;
