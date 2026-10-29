import type { OxlintExample } from './types.ts';

/** An example of the oxlint rule `name`, and the files in which oxlint reported the rule. */
type OxlintExampleMessagesInput = {
  readonly name: string;
  readonly example: OxlintExample;
  readonly flagged: ReadonlySet<string>;
};

/** What an example shows: nothing when oxlint judged it as its kind says, else that the rule misjudged it. */
export function oxlintExampleMessages({ name, example, flagged }: OxlintExampleMessagesInput): ReadonlyArray<string> {
  const { path, text, isViolation } = example;

  if (flagged.has(path) === isViolation) {
    return [];
  }

  if (isViolation) {
    return [`Fix ${name} or its violation example, such as \`${text}\`, which oxlint does not flag (TS-05)`];
  }

  return [`Fix ${name} or its allowed example, such as \`${text}\`, which oxlint flags (TS-05)`];
}
