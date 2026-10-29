import { Redacted } from 'effect';

type SlackAuthorizationInput = { readonly token: Redacted.Redacted };

/** Unwraps a server credential only when constructing its outbound authorization header. */
export function slackAuthorization({ token }: SlackAuthorizationInput): string {
  return `Bearer ${Redacted.value(token)}`;
}
