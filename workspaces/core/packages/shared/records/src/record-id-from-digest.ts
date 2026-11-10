import { RecordId } from './schemas.ts';

const UUID_HEX_LENGTH = 32;
const UUID_GROUPS = /^(.{8})(.{4}).(.{3}).(.{3})(.{12})$/u;
type DigestRecordIdInput = { readonly digest: string };

/** Derived record identities retain UUID version 8 and the fixed `a` variant nibble. */
export function recordIdFromDigest({ digest }: DigestRecordIdInput): RecordId {
  const value = digest.slice(0, UUID_HEX_LENGTH).replace(UUID_GROUPS, '$1-$2-8$3-a$4-$5');

  return RecordId.make(value);
}
