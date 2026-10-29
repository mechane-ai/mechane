import { LogCode } from '@mechane/protocol';
import { Predicate, Schema } from 'effect';

/** The code of an error whose tag or name is not a code, so a line never carries an error's own text. */
const UNKNOWN_ERROR = 'unknown';

type ErrorCodeInput = { readonly error: unknown };

type LogCodeInput = { readonly name: string };

/**
 * The code a line names an error by: its Effect tag, such as a tagged error's, or its name, such as a `TypeError`'s, in
 * snake case. Any other is `unknown`, so no line carries an error's own text.
 */
export function errorCode({ error }: ErrorCodeInput): string {
  if (Predicate.hasProperty(error, '_tag') && Predicate.isString(error._tag)) {
    return logCode({ name: error._tag });
  }

  if (Predicate.isError(error)) {
    return logCode({ name: error.name });
  }

  return UNKNOWN_ERROR;
}

/** A tag or a name in snake case, such as `allowance_refused`, or `unknown` when it makes no code. */
function logCode({ name }: LogCodeInput): string {
  const code = name.replaceAll(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

  if (!Schema.is(LogCode)(code)) {
    return UNKNOWN_ERROR;
  }

  return code;
}
