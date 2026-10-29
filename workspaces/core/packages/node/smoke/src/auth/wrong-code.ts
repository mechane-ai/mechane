import { USER_CODE_ALPHABET, USER_CODE_GROUP_CHARS, USER_CODE_GROUPS, userCodeOf } from '@mechane/protocol';
import { Array } from 'effect';
import { randomInt } from 'node:crypto';

/** A code no approval awaits but by chance: two groups of letters of the alphabet every code takes its own from. */
export function wrongCode(): string {
  const letter: () => string = () => USER_CODE_ALPHABET.charAt(randomInt(USER_CODE_ALPHABET.length));

  return userCodeOf({ letters: Array.makeBy(USER_CODE_GROUP_CHARS * USER_CODE_GROUPS, letter).join('') });
}
