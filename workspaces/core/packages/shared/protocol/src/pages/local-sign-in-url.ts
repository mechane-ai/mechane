import type { SecureOrigin } from '@mechane/deployment';
import { PagePath } from './constants.ts';

type LocalSignInUrlInput = { readonly origin: SecureOrigin };

/** The local bootstrap form's address, without any credential in the URL. */
export function localSignInUrl({ origin }: LocalSignInUrlInput): URL {
  return new URL(PagePath.LocalSignIn, origin);
}
