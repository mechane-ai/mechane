import type { SecureOrigin } from '@mechane/deployment';
import { PagePath } from './constants.ts';

type CallbackUrlInput = { readonly origin: SecureOrigin };

/** The deployment's callback page, the one URL GitHub returns a browser to; the OAuth App registers it. */
export function callbackUrl({ origin }: CallbackUrlInput): string {
  return new URL(PagePath.GitHubCallback, origin).href;
}
