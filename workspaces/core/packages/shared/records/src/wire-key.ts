import { String } from 'effect';
import { BOOLEAN_PREFIXES } from './constants.ts';

/** A capital letter of a camelCase field, which its snake_case wire key writes as `_` and the lowercase letter. */
const FIELD_WORD_START = /[A-Z]/g;

/** A boolean prefix that starts a camelCase field, before the capital letter of the field's next word. */
const BOOLEAN_PREFIX: Readonly<RegExp> = new RegExp(`^(?:${BOOLEAN_PREFIXES.join('|')})(?=[A-Z])`);

type WireKeyInput = { readonly field: string };

/**
 * The snake_case key under which the wire carries a camelCase field, such as `retry_after_seconds` for
 * `retryAfterSeconds`. A boolean field's key drops its prefix: `self_grading` for `isSelfGrading`. `WireKey` spells the
 * same derivation for the compiler.
 */
export function wireKey({ field }: WireKeyInput): string {
  const snakeWord: (letter: string) => string = (letter) => `_${letter.toLowerCase()}`;

  return String.uncapitalize(field.replace(BOOLEAN_PREFIX, '')).replaceAll(FIELD_WORD_START, snakeWord);
}
