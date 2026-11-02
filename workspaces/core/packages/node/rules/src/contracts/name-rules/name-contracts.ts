import type { ContractEnforcement, ContractName } from '@mechane/rule-shapes';
import { codeBlankLines } from './code-blank-lines.ts';
import { codeBooleanNames } from './code-boolean-names.ts';
import { codeCommentAttribution } from './code-comment-attribution.ts';
import { codeCommentContent } from './code-comment-content.ts';
import { codeCommentForm } from './code-comment-form.ts';
import { codeDomainVocabulary } from './code-domain-vocabulary.ts';
import { codeLintSuppressions } from './code-lint-suppressions.ts';
import { codeMeasuredValueNames } from './code-measured-value-names.ts';
import { codeNumericLiterals } from './code-numeric-literals.ts';
import { codeSpelledOutNames } from './code-spelled-out-names.ts';

/** The registry's entry for each contract of the names and comments section, in the order of their folders. */
export const NAME_CONTRACTS = {
  'code-blank-lines': codeBlankLines,
  'code-boolean-names': codeBooleanNames,
  'code-measured-value-names': codeMeasuredValueNames,
  'code-spelled-out-names': codeSpelledOutNames,
  'code-domain-vocabulary': codeDomainVocabulary,
  'code-comment-content': codeCommentContent,
  'code-comment-form': codeCommentForm,
  'code-comment-attribution': codeCommentAttribution,
  'code-lint-suppressions': codeLintSuppressions,
  'code-numeric-literals': codeNumericLiterals,
} as const satisfies Readonly<Partial<Record<ContractName, ContractEnforcement>>>;
