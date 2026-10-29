import type { AstGrepRule } from '@mechane/rule-shapes';
import { AST_GREP_RULES } from '@mechane/rules';
import { Option } from 'effect';
import type { RuleFile } from '../types.ts';

/** The registry's ast-grep rules, and every ast-grep rule file. */
type AstGrepMessagesInput = {
  readonly astGrep: ReadonlyArray<AstGrepRule>;
  readonly ruleFiles: ReadonlyArray<RuleFile>;
};

/**
 * Each ast-grep rule without its rule file, and each without a violation and an allowed example (TS-05). An installed
 * rule's file is its contract's, which the asset checks read.
 */
export function astGrepMessages({ astGrep, ruleFiles }: AstGrepMessagesInput): ReadonlyArray<string> {
  const authored: ReadonlySet<string> = new Set(ruleFiles.map(({ id }) => id));
  const isUnauthored: (rule: AstGrepRule) => boolean = ({ name, asset }) => Option.isNone(asset) && !authored.has(name);

  const unauthoredMessage: (rule: AstGrepRule) => string = ({ name }) =>
    `Add the rule file of ${name} or remove its entry, such as \`${AST_GREP_RULES}/${name}.yml\` (TS-05)`;

  const unexampledMessage: (rule: AstGrepRule) => string = ({ name }) =>
    `Give ${name} a violation and an allowed example, such as \`allowed: ['const isPaid = true;']\` (TS-05)`;

  return [
    ...astGrep.filter(isUnauthored).map(unauthoredMessage),
    ...astGrep
      .filter(({ violation, allowed }) => violation.length === 0 || allowed.length === 0)
      .map(unexampledMessage),
  ];
}
