import { MESSAGE_FORM, RuleTool } from '@mechane/rule-shapes';
import { REGISTERED_RULES } from '@mechane/rules';
import { Option } from 'effect';
import { REGISTRY } from '../constants.ts';
import type { RegistryFinding, RuleFile } from '../types.ts';

/** A fix an entry gives a tool to print, whose finding ends with the rule: the message form without the rule. */
const FIX_FORM = /^(?![\s\S]*\. )[A-Z][\s\S]*, such as `[^`]+`(?:[\s\S]*[^.])?$/;

/** The example a finding of a message without AS-01's form ends with: a message in the form, and AS-01. */
const FORM_EXAMPLE = "such as `Name it, such as 'isReady' (NM-07)` (AS-01)";

/** Every ast-grep rule file. */
type MessageFindingsInput = { readonly ruleFiles: ReadonlyArray<RuleFile> };

/** A fix another tool prints, and the rule of the standard its finding ends with. */
type PrintedFix = { readonly standard: string; readonly message: string };

/**
 * Each message that does not teach its fix as AS-01 says: an ast-grep rule's message that lacks the form, or that ends
 * with a rule unlike its entry's. A fix another tool prints without the fix's form is one too.
 */
export function messageFindings({ ruleFiles }: MessageFindingsInput): ReadonlyArray<RegistryFinding> {
  const standards = new Map(
    REGISTERED_RULES.map(({ rule }) => rule)
      .filter((rule) => rule.tool === RuleTool.AstGrep)
      .map(({ name, standard }) => [name, standard]),
  );

  const endsElsewhere: (ruleFile: RuleFile) => boolean = ({ id, message }) => {
    const endsUnlike: (standard: string) => boolean = (standard) => !message.endsWith(`(${standard})`);

    return Option.exists(Option.fromNullishOr(standards.get(id)), endsUnlike);
  };

  const endingFinding: (ruleFile: RuleFile) => RegistryFinding = ({ path, id }) => ({
    path,
    message: `End the message of ${id} with its entry's rule, such as \`(NM-07)\` (AS-01)`,
  });

  const isFormless: (ruleFile: RuleFile) => boolean = ({ message }) => !MESSAGE_FORM.test(message);

  const formFinding: (ruleFile: RuleFile) => RegistryFinding = ({ path }) => ({
    path,
    message: `Teach the fix with an example and end with the rule, ${FORM_EXAMPLE}`,
  });

  return [
    ...ruleFiles.filter(endsElsewhere).map(endingFinding),
    ...ruleFiles.filter(isFormless).map(formFinding),
    ...fixFindings(),
  ];
}

/** Each restricted rule's message and each dependency-cruiser rule's or family's comment that lacks the form. */
function fixFindings(): ReadonlyArray<RegistryFinding> {
  const rules = REGISTERED_RULES.map(({ rule }) => rule);
  const isFormless: (fix: PrintedFix) => boolean = ({ message }) => !FIX_FORM.test(message);

  const fixFinding: (fix: PrintedFix) => RegistryFinding = ({ standard }) => ({
    path: REGISTRY,
    message: `Teach the fix of ${standard}'s rule, ${FORM_EXAMPLE}`,
  });

  const fixes: ReadonlyArray<PrintedFix> = [
    ...rules
      .filter((rule) => rule.tool === RuleTool.Restricted)
      .map(({ standard, message }) => ({ standard, message })),
    ...rules
      .filter((rule) => rule.tool === RuleTool.Cruiser || rule.tool === RuleTool.Manifest)
      .map(({ standard, comment }) => ({ standard, message: comment })),
  ];

  return fixes.filter(isFormless).map(fixFinding);
}
