import { BEARER_SCHEME } from './constants.ts';

/** The token a request presents, such as a Mechane key. */
type BearerAuthorizationInput = { readonly token: string };

/** The `authorization` header's value that presents a token under the bearer scheme. */
export function bearerAuthorization({ token }: BearerAuthorizationInput): string {
  return `${BEARER_SCHEME} ${token}`;
}
