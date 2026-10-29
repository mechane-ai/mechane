import { USER_CODE_ALPHABET, USER_CODE_GROUP_CHARS, USER_CODE_GROUPS, userCodeOf } from '@mechane/protocol';

/**
 * A new user code of two groups of random letters, such as `BCDF-GHJK`. Each letter comes from a 32-bit random value,
 * so the remainder's bias toward the first letters is below one in a hundred million.
 */
export function issueUserCode(): string {
  const values = crypto.getRandomValues(new Uint32Array(USER_CODE_GROUP_CHARS * USER_CODE_GROUPS));
  const letters = Array.from(values, (value) => USER_CODE_ALPHABET.charAt(value % USER_CODE_ALPHABET.length));

  return userCodeOf({ letters: letters.join('') });
}
