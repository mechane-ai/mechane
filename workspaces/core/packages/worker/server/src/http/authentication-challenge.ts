import { HttpHeader } from '@mechane/records';

type AuthenticationChallengeInput = { readonly request: Request };

export function authenticationChallenge({ request }: AuthenticationChallengeInput): string {
  if (request.headers.has(HttpHeader.Authorization)) {
    return 'Bearer error="invalid_token"';
  }

  return 'Bearer';
}
