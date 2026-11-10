import { TOKEN_RANDOM_BYTES, USER_CODE_ALPHABET, USER_CODE_GROUP_CHARS, USER_CODE_GROUPS } from '@mechane/protocol';
import { createHash, randomBytes, randomInt } from 'node:crypto';

export function createAuthToken(prefix: string): string {
  return `${prefix}${randomBytes(TOKEN_RANDOM_BYTES).toString('base64url')}`;
}

export function hashAuthToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createUserCode(): string {
  const groups = Array.from({ length: USER_CODE_GROUPS }, createCodeGroup);

  return groups.join('-');
}

function createCodeGroup(): string {
  const letters = Array.from({ length: USER_CODE_GROUP_CHARS }, () =>
    USER_CODE_ALPHABET.charAt(randomInt(USER_CODE_ALPHABET.length)),
  );

  return letters.join('');
}
