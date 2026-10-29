import { RestrictedKey } from '@mechane/rules';
import { Option } from 'effect';
import type { OxlintDiagnostic } from '../schemas.ts';
import { configurationName } from './configuration-name.ts';

/** The key of an oxlint diagnostic that names no rule, such as a parse error or an unused directive. */
const UNNAMED_RULE = 'oxlint';

/** The standard rule a restricted entry's message ends with, such as `(ER-05)`. */
const RULE_ID = /\(([A-Z]{2}-\d{2})\)$/;

type RuleKeyInput = { readonly diagnostic: OxlintDiagnostic };

type CodeKeyInput = {
  readonly code: string;
  /** The fix the rule suggests; absent when it suggests none. */
  readonly help: Option.Option<string>;
};

/**
 * The key an oxlint diagnostic counts under. A restricted entry counts under its standard rule, such as `EF-02`, and
 * another rule under its configuration name, such as `typescript/return-await`. A parse error or an unused directive
 * counts under `oxlint`.
 */
export function ruleKey({ diagnostic }: RuleKeyInput): string {
  return Option.match(diagnostic.code, {
    onNone: () => UNNAMED_RULE,
    onSome: (code) => codeKey({ code, help: diagnostic.help }),
  });
}

/** The key of a diagnostic that names its rule: a restricted entry's standard rule, else its configuration name. */
function codeKey({ code, help }: CodeKeyInput): string {
  const open = code.indexOf('(');
  const rule = code.slice(open + 1, -1);

  const ruleIdMatch: (text: string) => Option.Option<RegExpExecArray> = (text) =>
    Option.fromNullishOr(RULE_ID.exec(text));

  const id = Option.flatMap(help, ruleIdMatch);

  if (Option.isSome(id) && (rule === RestrictedKey.Properties || rule === RestrictedKey.Imports)) {
    return id.value[0].slice(1, -1);
  }

  return configurationName({ plugin: code.slice(0, open), rule });
}
