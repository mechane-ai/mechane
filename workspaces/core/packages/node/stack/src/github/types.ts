import type { Option } from 'effect';

/** The OAuth App the local GitHub registers, and the login its sign-in form offers a person by default. */
export type LocalGitHub = {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly callbackUrl: string;
  readonly login: string;
};

export type GrantCodeInput = { readonly login: string; readonly redirectUri: string };

export type RedeemCodeInput = { readonly code: string; readonly redirectUri: string };

export type LoginInput = { readonly login: string };

export type TokenInput = { readonly token: string };

/**
 * What the local GitHub remembers while it serves: codes its sign-in form granted, the logins of the tokens it issued,
 * and the numeric id it gave each login. A login's id stays the same for the stack's life.
 */
export type GitHubLedger = {
  readonly grantCode: (input: GrantCodeInput) => string;
  /** The login of a granted code for the same callback, none for any other code; a code redeems once. */
  readonly redeemCode: (input: RedeemCodeInput) => Option.Option<string>;
  readonly issueAccessToken: (input: LoginInput) => string;
  /** The login a token was issued to, none for a token the local GitHub never issued. */
  readonly tokenLogin: (input: TokenInput) => Option.Option<string>;
  readonly userId: (input: LoginInput) => number;
};

/** A request as the local GitHub reads it. */
export type FakeRequest = {
  readonly method: string;
  readonly url: URL;
  readonly form: URLSearchParams;
  /** The request's `authorization` header as it came, which the user route decodes. */
  readonly authorization: unknown;
};

/** A request of the local GitHub, the ledger it reads and writes, and the OAuth App it serves. */
export type RouteInput = { readonly request: FakeRequest; readonly ledger: GitHubLedger; readonly github: LocalGitHub };
