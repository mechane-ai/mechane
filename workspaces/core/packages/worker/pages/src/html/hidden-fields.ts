import { escapeHtml } from '@mechane/utilities';
import { Record } from 'effect';

type HiddenFieldsInput = { readonly fields: Readonly<Record<string, string>> };

/** A form field's name and its encoded value. */
type FormField = readonly [string, string];

/** The hidden inputs of a form's encoded fields, which a browser posts back unchanged. */
export function hiddenFields({ fields }: HiddenFieldsInput): string {
  const hiddenInput: (field: FormField) => string = ([name, value]) =>
    `<input type="hidden" name="${name}" value="${escapeHtml({ text: value })}">`;

  return Record.toEntries(fields).map(hiddenInput).join('');
}
