import { SUBJECT_SEPARATOR } from '@mechane/rule-shapes';

type NameInput = { readonly name: string };

/**
 * The name the registry declares a configured rule under: a family's for each rule the family writes, such as `layer`
 * for `layer:@mechane/client`, and every other rule's own.
 */
export function registeredName({ name }: NameInput): string {
  return name.split(SUBJECT_SEPARATOR, 1).join('');
}
