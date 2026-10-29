import { Hex } from 'effect/encoding';
import type { TextInput } from './types.ts';

/** The SHA-256 digest of a text's UTF-8 bytes as lowercase hex. */
export async function sha256Hex({ text }: TextInput): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));

  return Hex.encode(new Uint8Array(digest));
}
