import type { OwnedExample, OwnedRule } from '@mechane/rule-shapes';
import { exampleText } from './example-text.ts';

/** An owned rule to explain. */
type OwnedDetailsInput = { readonly rule: OwnedRule };

/** An owned rule's examples, each tree on one line. */
export function ownedDetails({ rule }: OwnedDetailsInput): ReadonlyArray<string> {
  const flagLine: (example: OwnedExample) => string = (example) => `  flags: ${exampleText({ example })}`;
  const passLine: (example: OwnedExample) => string = (example) => `  passes: ${exampleText({ example })}`;

  return [...rule.violation.map(flagLine), ...rule.allowed.map(passLine)];
}
