import type { OwnedExample, OwnedRule } from '@mechane/rule-shapes';
import { Option, Record } from 'effect';
import { UNEXAMPLED_RULES } from './constants.ts';
import { exampleMessages } from './example-messages.ts';
import { EXAMPLE_RUNS } from './example-runs.ts';
import type { ExampleWorkspace } from './types.ts';

/** An owned rule, and what its examples' indexes share with the workspace. */
type OwnedRuleMessagesInput = { readonly rule: OwnedRule; readonly workspace: ExampleWorkspace };

type UnexampledMessagesInput = { readonly rule: OwnedRule };

/** What one owned rule's examples show: a missing run or example, or each example its run misjudges. */
export function ownedRuleMessages({ rule, workspace }: OwnedRuleMessagesInput): ReadonlyArray<string> {
  const { name, violation, allowed } = rule;
  const run = Record.get(EXAMPLE_RUNS, name);

  if (Option.isNone(run)) {
    return unexampledMessages({ rule });
  }

  if (violation.length === 0 || allowed.length === 0) {
    return [
      `Give ${name} a violation and an allowed example, such as \`allowed: [{ 'scripts/a.ts': 'export const a = 1;' }]\` (TS-05)`,
    ];
  }

  /** What a violation example shows under the rule's run. */
  const violationMessages: (example: OwnedExample) => ReadonlyArray<string> = (example) =>
    exampleMessages({ name, run: run.value, example, workspace, isViolation: true });

  /** What an allowed example shows under the rule's run. */
  const allowedMessages: (example: OwnedExample) => ReadonlyArray<string> = (example) =>
    exampleMessages({ name, run: run.value, example, workspace, isViolation: false });

  return [...violation.flatMap(violationMessages), ...allowed.flatMap(allowedMessages)];
}

/** A rule without a run, which only a rule no small tree shows may be, and then only without examples. */
function unexampledMessages({ rule }: UnexampledMessagesInput): ReadonlyArray<string> {
  const { name, violation, allowed } = rule;

  if (UNEXAMPLED_RULES.has(name) && violation.length + allowed.length === 0) {
    return [];
  }

  return [
    `Give ${name} a run that its examples prove, such as \`'${name}': sourceSitesRun\` in the example runs (TS-05)`,
  ];
}
