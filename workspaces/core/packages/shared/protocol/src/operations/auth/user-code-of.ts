import { USER_CODE_GROUP_CHARS } from './constants.ts';

/** A user code's letters in order, without the hyphen between its groups. */
type UserCodeLettersInput = { readonly letters: string };

/** The user code of its letters, written as its two groups with a hyphen between them, such as `BCDF-GHJK`. */
export function userCodeOf({ letters }: UserCodeLettersInput): string {
  return `${letters.slice(0, USER_CODE_GROUP_CHARS)}-${letters.slice(USER_CODE_GROUP_CHARS)}`;
}
