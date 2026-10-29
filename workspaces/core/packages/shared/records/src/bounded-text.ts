import { Schema } from 'effect';
import { isWellFormedText } from './schemas.ts';

/** The most bytes a text holds in UTF-8. */
type MaxBytesInput = { readonly maxBytes: number };

/**
 * A text that any process, row or file holds: not empty, of whole characters, with no NUL character, which ends a
 * process's argument, and at most `maxBytes` bytes in UTF-8.
 */
export function boundedText({ maxBytes }: MaxBytesInput): typeof Schema.NonEmptyString {
  return Schema.NonEmptyString.check(
    isWellFormedText,
    Schema.makeFilter((text) => !text.includes('\u0000'), { expected: 'a text without a NUL character' }),
    Schema.makeFilter((text) => new TextEncoder().encode(text).byteLength <= maxBytes, {
      expected: `a text of at most ${maxBytes} bytes in UTF-8`,
    }),
  );
}
