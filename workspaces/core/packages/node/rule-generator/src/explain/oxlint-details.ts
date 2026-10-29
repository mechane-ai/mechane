import type { OxlintRule } from '@mechane/rule-shapes';
import { Option } from 'effect';

/** An oxlint rule to explain. */
type OxlintDetailsInput = { readonly rule: OxlintRule };

/** An oxlint rule's note, suppression budget and examples. */
export function oxlintDetails({ rule }: OxlintDetailsInput): ReadonlyArray<string> {
  const noteLine: (note: string) => string = (note) => `  note: ${note}`;
  const flagLine: (example: string) => string = (example) => `  flags: ${example}`;
  const passLine: (example: string) => string = (example) => `  passes: ${example}`;

  return [
    ...Option.toArray(rule.note).map(noteLine),
    `  suppressions allowed: ${String(rule.maxSuppressions)}`,
    ...rule.violation.map(flagLine),
    ...rule.allowed.map(passLine),
  ];
}
