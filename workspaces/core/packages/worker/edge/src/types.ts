import type { Access, KeyMetadata, Principal } from '@mechane/protocol';
import type { Option } from 'effect';

/**
 * Who each access admits: no caller for a public operation, and a key's caller for a principal one or for a member one,
 * whose workspace admission checked.
 */
export type AccessCaller = {
  /** Always absent: a public operation acts for no caller. */
  readonly [Access.Public]: Option.Option<never>;
  readonly [Access.Principal]: Caller;
  readonly [Access.Member]: Caller;
};

/** Path parameters as the path carries them, before percent-decoding. */
export type RawPathParams = Readonly<Record<string, string>>;

/** The principal a request's key acts for, and that key. */
export type Caller = { readonly principal: Principal; readonly key: KeyMetadata };
