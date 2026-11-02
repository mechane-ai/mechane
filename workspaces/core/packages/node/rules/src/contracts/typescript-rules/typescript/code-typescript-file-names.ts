import { ADOPTED, FixBehavior, OXLINT_DEFAULTS, Severity } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** What enforces `code-typescript-file-names`: kebab-case file names. */
export const codeTypescriptFileNames = {
  values: {},
  rules: [
    {
      ...OXLINT_DEFAULTS,
      ...ADOPTED,
      name: 'unicorn/filename-case',
      behavior: FixBehavior.BindingNames,
      value: [Severity.Error, { case: 'kebabCase' }],
      standard: 'NM-20',
    },
  ],
} as const satisfies ContractEnforcement;
