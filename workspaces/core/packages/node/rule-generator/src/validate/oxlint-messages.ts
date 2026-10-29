import { RuleStatus, Severity } from '@mechane/rule-shapes';
import type { OxlintRule } from '@mechane/rule-shapes';
import { CONTRACTS } from '@mechane/rules';
import { Record } from 'effect';
import { repeatedNames } from './repeated-names.ts';

/** The severities AS-04 allows: every rule is an error or off, never a warning. */
const SEVERITIES: ReadonlySet<unknown> = new Set([Severity.Error, Severity.Off]);

/** The registry's oxlint rules. */
type OxlintMessagesInput = { readonly oxlint: ReadonlyArray<OxlintRule> };

/** An oxlint rule's configured value. */
type RuleSeverityInput = { readonly value: unknown };

/**
 * Each oxlint rule whose severity is not an error or off (AS-04), each name with two running entries, and each opt-out
 * that also runs or sits on both lists.
 */
export function oxlintMessages({ oxlint }: OxlintMessagesInput): ReadonlyArray<string> {
  const { pending, decided } = CONTRACTS['code-lint-suppressions'].values.oxlint.optOuts;
  const running = oxlint.filter(({ status }) => status !== RuleStatus.Proposed).map(({ name }) => name);
  const runningNames: ReadonlySet<string> = new Set(running);
  const optOuts = [...pending, ...Record.keys(decided)];
  const isWarned: (rule: OxlintRule) => boolean = ({ value }) => !SEVERITIES.has(ruleSeverity({ value }));

  const severityMessage: (rule: OxlintRule) => string = ({ name }) =>
    `Set ${name} to error or off, such as \`"error"\` (AS-04)`;

  const repeatedMessage: (name: string) => string = (name) =>
    `Keep one running entry of ${name} and propose the others, such as \`status: RuleStatus.Proposed\` (110)`;

  const listedTwiceMessage: (name: string) => string = (name) =>
    `List ${name} once among the opt-outs, such as \`pending: ['${name}']\` (110)`;

  const runningOptOutMessage: (name: string) => string = (name) =>
    `Remove ${name} from the opt-outs, such as \`pending: []\`, since it runs (110)`;

  return [
    ...oxlint.filter(isWarned).map(severityMessage),
    ...repeatedNames({ names: running }).map(repeatedMessage),
    ...repeatedNames({ names: optOuts }).map(listedTwiceMessage),
    ...optOuts.filter((name) => runningNames.has(name)).map(runningOptOutMessage),
  ];
}

/** A rule's severity: its value, or the first element of a value that also holds the rule's options. */
function ruleSeverity({ value }: RuleSeverityInput): unknown {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
