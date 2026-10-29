import { renamedWireStruct, wireStruct } from '@mechane/records';
import { Schema } from 'effect';

/** The state a sign-in sends GitHub, which GitHub returns unchanged to the callback page. */
const SignInState = Schema.String;

/** The code GitHub returns to the callback page once the person signed in, which the deployment exchanges once. */
const AuthorizationCode = Schema.String;

/** An OAuth error GitHub reports in place of a code or a token, such as `access_denied`. */
const GitHubErrorCode = Schema.String;

/** The query that sends a browser to GitHub's authorization page; a sign-in asks for no scope. */
export const GitHubAuthorizeQuery = wireStruct({
  fields: { clientId: Schema.String, redirectUri: Schema.String, state: SignInState },
});

export type GitHubAuthorizeQuery = typeof GitHubAuthorizeQuery.Type;

/** The query with which GitHub returns a browser to the callback page once the person signed in there. */
export const GitHubGrantedCallback = renamedWireStruct({
  fields: { authorizationCode: AuthorizationCode, state: SignInState },
  renames: { authorizationCode: 'code' },
});

export type GitHubGrantedCallback = typeof GitHubGrantedCallback.Type;

/** The query with which GitHub returns a browser without a sign-in, such as `error=access_denied`. */
const GitHubDeniedCallback = wireStruct({ fields: { error: GitHubErrorCode } });

/** The query of a return from GitHub: a granted sign-in, or GitHub's error, which carries no code. */
export const GitHubCallbackQuery = Schema.Union([GitHubGrantedCallback, GitHubDeniedCallback]);

export type GitHubCallbackQuery = typeof GitHubCallbackQuery.Type;

/** The form that exchanges an authorization code for a user's access token. */
export const GitHubTokenRequest = wireStruct({
  fields: {
    clientId: Schema.String,
    clientSecret: Schema.RedactedFromValue(Schema.String),
    code: AuthorizationCode,
    redirectUri: Schema.String,
  },
});

export type GitHubTokenRequest = typeof GitHubTokenRequest.Type;

/** GitHub's answer to the exchange, which reports a refused code with status 200 and an `error` field. */
export const GitHubTokenAnswer = Schema.Union([
  wireStruct({ fields: { accessToken: Schema.RedactedFromValue(Schema.String) } }),
  Schema.Struct({ error: GitHubErrorCode }),
]);

export type GitHubTokenAnswer = typeof GitHubTokenAnswer.Type;

/** The signed-in user; `id` is GitHub's stable numeric id, and `login` a name its owner may change. */
export const GitHubUser = Schema.Struct({ id: Schema.Int, login: Schema.String });

export type GitHubUser = typeof GitHubUser.Type;
