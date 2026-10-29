import type { FillKeyInput } from '@mechane/protocol';
import type { TokenHashInput } from '@mechane/records';
import type { CachedResolution, JudgedKey } from './keys.schemas.ts';

/** Each RPC method of a key cache shard. */
type KeyCacheMethods = {
  /** The count of schema migrations the shard's database has applied. */
  readonly schemaRevision: () => number;
  readonly resolveKey: (input: TokenHashInput) => typeof CachedResolution.Encoded;
  /** Stores the directory's resolution of a key the shard missed, unless a row came first, and judges what it holds. */
  readonly fillKey: (input: FillKeyInput) => typeof JudgedKey.Encoded;
  /** Writes the key's tombstone, before the directory revokes it, so the revoked key fails at once. */
  readonly revokeKey: (input: TokenHashInput) => void;
};

/**
 * The methods a key cache shard serves by RPC, each answering with plain data the Worker decodes. The bindings name the
 * object by this type, so they need not import the object.
 */
export type KeyCacheRpc = Rpc.DurableObjectBranded & KeyCacheMethods;
