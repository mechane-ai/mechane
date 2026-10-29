import { ADOPTED, FixBehavior, OWNED_DEFAULTS, OXLINT_DEFAULTS, RuleFix, Severity } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** The characters a line may hold, which the formatter wraps code at and the comment-width check holds comments to. */
const LINE_CHARS = 120;

/**
 * The line width, and the formatter's options, which wrap code and Markdown prose at that width. The formatter leaves
 * library contract text, the lockfile, the generated reference and locks, and the ratchet baselines alone. In the
 * factory, which formats its own files with the same options, it leaves the context, the contracts and Tenet's lock
 * alone.
 */
const VALUES = {
  lineChars: LINE_CHARS,
  formatter: {
    printWidth: LINE_CHARS,
    tabWidth: 2,
    useTabs: false,
    singleQuote: true,
    trailingComma: 'all',
    quoteProps: 'consistent',
    objectWrap: 'collapse',
    proseWrap: 'preserve',
    sortImports: {
      groups: [['builtin', 'external', 'internal', 'subpath'], ['parent', 'sibling', 'index'], 'unknown'],
      newlinesBetween: false,
      ignoreCase: true,
    },
    sortPackageJson: { sortScripts: true },
    jsdoc: {
      commentLineStrategy: 'singleLine',
      lineWrappingStyle: 'greedy',
      capitalizeDescriptions: false,
      addDefaultToDescription: false,
    },
    overrides: [{ files: ['**/*.md'], options: { proseWrap: 'always' } }],
  },
  formatterIgnores: [
    '.contracts/**',
    'pnpm-lock.yaml',
    'packages/node/cli/reference.json',
    'lint/wire.json',
    'lint/migrations.json',
    'lint/baseline/**',
  ],
  factoryFormatterIgnores: ['.context/**', '.contracts/**', '.tenet.lock'],
} as const;

/** What enforces `code-comment-form`: the line width, no task marker, and no empty doc comment. */
export const codeCommentForm = {
  values: VALUES,
  rules: [
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'no-warning-comments',
      behavior: FixBehavior.TypeOnly,
      value: [Severity.Error, { terms: ['todo', 'fixme', 'xxx', 'hack'], location: 'anywhere' }],
      standard: 'CD-02',
    },
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'jsdoc/no-blank-blocks',
      fix: RuleFix.Oxlint,
      behavior: FixBehavior.TypeOnly,
      value: Severity.Error,
      standard: 'CD-02',
    },
    {
      ...OWNED_DEFAULTS,
      name: 'comment-width',
      behavior: FixBehavior.TypeOnly,
      standard: 'CD-07',
      violation: [{ 'scripts/a.ts': `// ${'w'.repeat(LINE_CHARS)}\nexport const a = 1;\n` }],
      allowed: [{ 'scripts/a.ts': '// A comment within the line width\nexport const a = 1;\n' }],
      ...ADOPTED,
    },
  ],
} as const satisfies ContractEnforcement;
