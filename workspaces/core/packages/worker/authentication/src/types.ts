import type { WorkerSettings } from '@mechane/bindings';
import type { KeyMetadata, Principal } from '@mechane/protocol';
import type { BrowserIdentity } from '@mechane/records';
import type { Option } from 'effect';

/** A validated browser identity and the token carried by its HttpOnly cookie. */
export type BrowserSession = BrowserIdentity & { readonly token: string };

export type AuthenticateInput = { readonly request: Request; readonly settings: WorkerSettings };

/** Browser sessions exercise the principal's authority without minting an API key. */
export type Caller = {
  readonly principal: Principal;
  /** None for a browser session. */
  readonly key: Option.Option<KeyMetadata>;
};
