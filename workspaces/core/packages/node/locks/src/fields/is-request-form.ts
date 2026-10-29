import { RECORD_TEXT_MAX_CHARS } from '@mechane/records';
import { Option } from 'effect';
import type { JsonSchemaNode } from './schemas.ts';

/** A node or a schema it joins, and the pattern of a caller-made id's request form, which no answer may ask. */
type IsRequestFormInput = {
  readonly form: Pick<JsonSchemaNode, 'maxLength' | 'pattern'>;
  /** The pattern Effect writes for `RandomId`, which a form without a pattern never matches. */
  readonly requestIdPattern: Option.Option<string>;
};

/** Whether a form bounds a text below a record's, or asks the version 4 UUID of a caller-made id's request. */
export function isRequestForm({ form, requestIdPattern }: IsRequestFormInput): boolean {
  return (
    Option.exists(form.maxLength, (chars) => chars < RECORD_TEXT_MAX_CHARS) ||
    Option.exists(form.pattern, (pattern) => Option.contains(requestIdPattern, pattern))
  );
}
