import type { FixExample } from './types.ts';

/** A fix example of the rule `name`, and the text the fix left in its file. */
type FixMessageInput = { readonly name: string; readonly example: FixExample; readonly left: string };

/** What a fix example shows: nothing when the fix left its `fixed` text, or the text it left. */
export function fixMessage({ name, example, left }: FixMessageInput): ReadonlyArray<string> {
  if (left === example.fixed) {
    return [];
  }

  return [
    `Fix ${name} or its fixed example, such as \`fixed: [${JSON.stringify(left)}]\`, which its fix leaves of ${JSON.stringify(example.violation)} (TS-05)`,
  ];
}
