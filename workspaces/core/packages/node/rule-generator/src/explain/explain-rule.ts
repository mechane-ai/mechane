import { FixBehavior, RuleFix } from '@mechane/rule-shapes';
import type { RegisteredRule, Rule } from '@mechane/rule-shapes';
import { findingKey, REGISTERED_RULES, ruleText } from '@mechane/rules';
import type { RuleFile } from '../types.ts';
import { toolDetails } from './tool-details.ts';

/** The rule's name or rule of the standard to explain, and every ast-grep rule file, whose message it prints. */
type ExplainInput = { readonly subject: string; readonly ruleFiles: ReadonlyArray<RuleFile> };

/** A rule to explain, and every ast-grep rule file, whose message it prints. */
type DetailsInput = { readonly rule: Rule; readonly ruleFiles: ReadonlyArray<RuleFile> };

/** What `explain` says of each fix: the tool that applies it, or that a person makes it. */
const AUTOFIXES = {
  [RuleFix.Oxlint]: 'its safe fix, which `oxlint --fix` applies',
  [RuleFix.AstGrep]: 'its fix, which `ast-grep scan -U` applies',
  [RuleFix.Codemod]: 'its codemod, which a sweep applies, and fix once the rule is enforced',
  [RuleFix.Manual]: 'none; fix each finding by hand',
} as const satisfies Readonly<Record<RuleFix, string>>;

/** What `explain` says of each fix behavior: the proof its commit needs (TS-07). */
const PROOFS = {
  [FixBehavior.TypeOnly]: 'type-only, so every bundle of the fingerprint stays equal',
  [FixBehavior.BindingNames]: 'binding names, so every bundle of the fingerprint stays equal',
  [FixBehavior.FieldNames]: 'field names, so the smoke must pass, and a sweep leaves the unexercised paths',
  [FixBehavior.Restructure]: 'a restructure, so the smoke must pass, and a sweep leaves the unexercised paths',
} as const satisfies Readonly<Record<FixBehavior, string>>;

/**
 * Each rule that `subject` names, by the key its findings count under or by its rule of the standard. Each prints the
 * sentence its contract's block states, then its message, its suppression budget, its examples, its autofix and the
 * proof its fix needs.
 */
export function explainRule({ subject, ruleFiles }: ExplainInput): ReadonlyArray<string> {
  const isNamed: (registered: RegisteredRule) => boolean = ({ rule }) =>
    findingKey({ rule }) === subject || rule.standard === subject;

  const ruleLines: (registered: RegisteredRule) => ReadonlyArray<string> = ({ contract, rule }) => [
    `${contract}: ${ruleText({ rule })}`,
    ...details({ rule, ruleFiles }),
  ];

  return REGISTERED_RULES.filter(isNamed).flatMap(ruleLines);
}

/** What a rule's sentence leaves out: what its findings say, how they are fixed and proved, and what it allows. */
function details({ rule, ruleFiles }: DetailsInput): ReadonlyArray<string> {
  return [
    ...toolDetails({ rule, ruleFiles }),
    `  autofix: ${AUTOFIXES[rule.fix]}`,
    `  proof: ${PROOFS[rule.behavior]}`,
  ];
}
