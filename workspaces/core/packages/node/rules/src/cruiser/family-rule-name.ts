import { SUBJECT_SEPARATOR } from '@mechane/rule-shapes';
import type { ManifestFamily } from '@mechane/rule-shapes';

/** A family of the registry, and the member, lane or package one of its rules is written for. */
type FamilyRuleNameInput = { readonly family: ManifestFamily; readonly subject: string };

/** The name of a family's rule for one subject, such as `layer:@mechane/client`, which `registeredName` reads back. */
export function familyRuleName({ family, subject }: FamilyRuleNameInput): string {
  return `${family}${SUBJECT_SEPARATOR}${subject}`;
}
