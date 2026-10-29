import {
  ADOPTED,
  AST_GREP_DEFAULTS,
  FileRole,
  OXLINT_DEFAULTS,
  RolloutPhase,
  RuleStatus,
  Severity,
} from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** A function's lines without blanks and comments, the blocks and callbacks it may nest, and its paths through. */
const VALUES = { functionLines: 30, nestingDepth: 2, nestedCallbacks: 2, complexity: 6 } as const;

/**
 * What enforces `code-function-size`: length, nesting and callbacks, and the standard's depth and complexity. A schema
 * step has no length bound: the migration lock hashes each step whole, so a store's first schema stays one function. A
 * migrations file holds nothing but its steps.
 */
export const codeFunctionSize = {
  values: VALUES,
  rules: [
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'max-lines-per-function',
      value: [Severity.Error, { max: VALUES.functionLines, skipBlankLines: true, skipComments: true, IIFEs: true }],
      exemptRoles: [FileRole.Migrations],
      standard: 'ST-22',
    },
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
    {
      ...OXLINT_DEFAULTS,
      name: 'max-depth',
      value: [Severity.Error, { max: VALUES.nestingDepth }],
      standard: 'ST-23',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
    },
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'max-nested-callbacks',
      value: [Severity.Error, { max: VALUES.nestedCallbacks }],
      standard: 'ST-23',
    },
    {
      ...OXLINT_DEFAULTS,
      name: 'complexity',
      value: [Severity.Error, { max: VALUES.complexity, variant: 'modified' }],
      standard: 'ST-24',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'case-shape',
      standard: 'ST-27',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
      violation: [
        'switch (phase) { case Phase.Starting: start({ run }); record({ run }); break; }',
        'switch (phase) { case Phase.Starting: return run.pipe(Effect.tap(() => { record({ run }); })); }',
        'Match.valueTags(change, { Write: (write) => { record({ write }); return saved({ write }); } });',
        'switch (phase) { case Phase.Starting: return text.indexOf(start) + text.lastIndexOf(end); }',
        'Match.valueTags(change, { Write: (write) => heading({ write }) + saved({ write }) });',
      ],
      allowed: [
        'switch (phase) { case Phase.Starting: return advanceStarting({ run }); }',
        'switch (phase) { case Phase.Starting: advanceStarting({ run }); break; }',
        'switch (phase) { case Phase.Starting: return advanceStarting({ run: started(run) }); }',
        'Match.valueTags(change, { Write: (write) => saveWrite({ store, write }), Delete: saveDeletion });',
      ],
    },
  ],
} as const satisfies ContractEnforcement;
