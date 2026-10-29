import { RuleTool } from '@mechane/rule-shapes';
import type { AstGrepRule, NormalizerRewrite, Rule } from '@mechane/rule-shapes';
import type { RuleFile } from '../types.ts';
import { exampleText } from './example-text.ts';
import { ownedDetails } from './owned-details.ts';
import { oxlintDetails } from './oxlint-details.ts';

/** A rule to explain, and every ast-grep rule file, whose message it prints. */
type ToolDetailsInput = { readonly rule: Rule; readonly ruleFiles: ReadonlyArray<RuleFile> };

/** An ast-grep rule to explain, and every ast-grep rule file, whose message it prints. */
type AstGrepDetailsInput = { readonly rule: AstGrepRule; readonly ruleFiles: ReadonlyArray<RuleFile> };

/** What only a rule's tool holds: its examples or rewrites, a budget, a message or a note. */
export function toolDetails({ rule, ruleFiles }: ToolDetailsInput): ReadonlyArray<string> {
  const rewriteLine: (rewrite: NormalizerRewrite) => string = ({ before, after }) =>
    `  rewrites: ${exampleText({ example: before })} to ${exampleText({ example: after })}`;

  switch (rule.tool) {
    case RuleTool.AstGrep:
      return astGrepDetails({ rule, ruleFiles });
    case RuleTool.Oxlint:
      return oxlintDetails({ rule });
    case RuleTool.Restricted:
      return [`  message: ${rule.message} (${rule.standard})`];
    case RuleTool.Owned:
      return ownedDetails({ rule });
    case RuleTool.Normalizer:
      return rule.rewrites.map(rewriteLine);
    case RuleTool.Compiler:
    case RuleTool.Cruiser:
    case RuleTool.Manifest:
      return [];
  }
}

/** An ast-grep rule's message, suppression budget and examples. */
function astGrepDetails({ rule, ruleFiles }: AstGrepDetailsInput): ReadonlyArray<string> {
  const messageLine: (file: RuleFile) => string = ({ message }) => `  message: ${message}`;
  const flagLine: (example: string) => string = (example) => `  flags: ${example}`;
  const passLine: (example: string) => string = (example) => `  passes: ${example}`;

  return [
    ...ruleFiles.filter(({ id }) => id === rule.name).map(messageLine),
    `  suppressions allowed: ${String(rule.maxSuppressions)}`,
    ...rule.violation.map(flagLine),
    ...rule.allowed.map(passLine),
  ];
}
