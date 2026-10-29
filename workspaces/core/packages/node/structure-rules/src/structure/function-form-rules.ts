import { AST_GREP_DEFAULTS, OXLINT_DEFAULTS, RolloutPhase, RuleStatus, Severity } from '@mechane/rule-shapes';

/**
 * The rules of how `code-module-structure-and-control-flow` writes a function: never as a pass-through of its
 * parameters, and after the class it reads. It repeats with a loop rather than calling itself.
 */
export const FUNCTION_FORM_RULES = [
  {
    ...AST_GREP_DEFAULTS,
    name: 'pass-through-function',
    standard: 'ST-28',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.Fixers,
    violation: [
      'function isGlobMatch({ file, pattern }: MatchInput): boolean { return matchesGlob(file, pattern); }',
      'function admit({ access, request }: AdmitInput): Admitted { return ADMISSIONS[access]({ request }); }',
    ],
    allowed: [
      'function readRows({ sql }: ReadInput): Rows { return sql.exec(STATEMENT); }',
      'const recordTurn = (input: TurnInput): void => insertTurn({ sql, ...input });',
      'function lastLine({ text }: TextInput): string { const lines = text.split(EOL); return lines.at(-1); }',
      'function isListed({ path, patterns }: ListedInput): boolean { const matches: (pattern: string) => boolean = (pattern) => matchesGlob(path, pattern); return patterns.some(matches); }',
    ],
  },
  {
    ...AST_GREP_DEFAULTS,
    name: 'loop-recursion',
    standard: 'EF-18',
    status: RuleStatus.Ratchet,
    phase: RolloutPhase.EffectDialect,
    violation: [
      'function walk({ node }: WalkInput): void { for (const child of node.children) { walk({ node: child }); } }',
    ],
    allowed: [
      'function walk({ root }: WalkInput): void { const pending = [root]; while (pending.length > 0) { pending.push(...pending.pop().children); } }',
    ],
  },
  {
    ...OXLINT_DEFAULTS,
    name: 'no-use-before-define',
    value: [
      Severity.Error,
      { functions: false, classes: true, variables: false, typedefs: false, ignoreTypeReferences: true },
    ],
    standard: 'ST-29',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.Proof,
  },
] as const;
