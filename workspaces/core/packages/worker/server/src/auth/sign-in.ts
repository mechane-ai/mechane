import type { Identity } from '@mechane/control-store';
import { IdentityNotAdmitted, TokenPrefix } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import {
  BROWSER_SESSION_SECONDS,
  createAuthToken,
  hashAuthToken,
  isIdentityAllowed,
  SIGN_IN_SECONDS,
} from '@mechane/runtime';
import type { AuthenticationConfiguration } from '@mechane/runtime';
import { escapeHtml } from '@mechane/utilities';
import { timingSafeEqual } from 'node:crypto';
import { cookieHeader, readCookie, readCookieTokenHash } from './cookies.ts';
import { exchangeGithubCode } from './github.ts';
import { authPage, AuthPageError } from './page.ts';
import type { AuthRequest } from './types.ts';

const MILLISECONDS_PER_SECOND = 1000;
type InitialWorkspaceInput = { readonly identity: Identity; readonly configuration: AuthenticationConfiguration };

function initialWorkspace({ identity, configuration }: InitialWorkspaceInput) {
  if (!isIdentityAllowed(identity, configuration.administrators)) {
    return null;
  }

  return {
    workspaceId: configuration.bootstrapWorkspaceId,
    workspaceName: configuration.bootstrapWorkspaceName,
    dailyCapMicros: configuration.dailyCapMicros,
  };
}

function returnDestination(request: Request, origin: string): string {
  const requested = new URL(request.url).searchParams.get('returnTo');

  if (requested === null) {
    return '/console';
  }

  const destination = new URL(requested, origin);

  if (destination.origin !== origin) {
    throw new AuthPageError('The return destination must belong to this installation.', HttpStatusCode.BadRequest);
  }

  if (destination.pathname === '/device') {
    return '/device';
  }

  if (destination.pathname === '/console' || destination.pathname.startsWith('/console/')) {
    return `${destination.pathname}${destination.search}`;
  }

  throw new AuthPageError('The return destination is not supported.', HttpStatusCode.BadRequest);
}

function secretMatches(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftHash = encoder.encode(hashAuthToken(left));
  const rightHash = encoder.encode(hashAuthToken(right));

  return timingSafeEqual(leftHash, rightHash);
}

export async function startSignIn({ request, store, configuration }: AuthRequest): Promise<Response> {
  const state = createAuthToken(TokenPrefix.SignIn);
  const returnTo = returnDestination(request, configuration.origin);
  const expiresAt = new Date(Date.now() + SIGN_IN_SECONDS * MILLISECONDS_PER_SECOND).toISOString();
  const previousSignInTokenHash = readCookieTokenHash({ request, origin: configuration.origin, name: 'sign_in' });

  await store.auth.openSignIn({ tokenHash: hashAuthToken(state), previousSignInTokenHash, returnTo, expiresAt });

  const target = new URL('/login/oauth/authorize', configuration.githubWebOrigin);

  target.searchParams.set('client_id', configuration.githubClientId);
  target.searchParams.set('redirect_uri', new URL('/auth/github/callback', configuration.origin).href);
  target.searchParams.set('state', state);

  const cookie = cookieHeader({
    origin: configuration.origin,
    name: 'sign_in',
    value: state,
    maxAgeSeconds: SIGN_IN_SECONDS,
  });

  return new Response(null, {
    status: HttpStatusCode.Ok,
    headers: { location: target.href, [HttpHeader.CacheControl]: 'no-store', [HttpHeader.SetCookie]: cookie },
  });
}

export async function finishSignIn({ request, store, configuration }: AuthRequest): Promise<Response> {
  const query = new URL(request.url).searchParams;

  if (query.has('error')) {
    throw new AuthPageError('Sign-in was not authorized. You can try again.', HttpStatusCode.Forbidden);
  }

  const state = query.get('state');
  const code = query.get('code');
  const cookieState = readCookie({ request, origin: configuration.origin, name: 'sign_in' });
  const hasMissingSignInFields = state === null || code === null || cookieState === null;

  if (hasMissingSignInFields || !secretMatches(state, cookieState)) {
    throw new AuthPageError(
      'The sign-in expired or belongs to another browser. Start again.',
      HttpStatusCode.BadRequest,
    );
  }

  const token = createAuthToken(TokenPrefix.Session);
  const signInTokenHash = hashAuthToken(state);
  const tokenHash = hashAuthToken(token);
  const returnTo = await store.auth.claimSignIn({ tokenHash: signInTokenHash, sessionTokenHash: tokenHash });

  if (returnTo === null) {
    throw new AuthPageError('The sign-in expired or was already used. Start again.', HttpStatusCode.BadRequest);
  }

  const user = await exchangeGithubCode({ configuration, code });
  const identity = { provider: 'github' as const, subject: String(user.id), login: user.login };

  if (!isIdentityAllowed(identity, configuration.allowedIdentities)) {
    throw new IdentityNotAdmitted({});
  }

  const expiresAt = new Date(Date.now() + BROWSER_SESSION_SECONDS * MILLISECONDS_PER_SECOND).toISOString();
  const bootstrap = initialWorkspace({ identity, configuration });

  const principal = await store.auth.openIdentitySession({
    identity,
    signInTokenHash,
    tokenHash,
    expiresAt,
    bootstrap,
    personalDailyCapMicros: configuration.dailyCapMicros,
  });

  if (principal === null) {
    throw new AuthPageError('The sign-in expired or was cancelled. Start again.', HttpStatusCode.BadRequest);
  }

  const destination = new URL(returnTo, configuration.origin).href;
  const headers = new Headers({ location: destination, [HttpHeader.ReferrerPolicy]: 'no-referrer' });

  headers.append(
    HttpHeader.SetCookie,
    cookieHeader({
      origin: configuration.origin,
      name: 'session',
      value: token,
      maxAgeSeconds: BROWSER_SESSION_SECONDS,
    }),
  );
  headers.append(
    HttpHeader.SetCookie,
    cookieHeader({ origin: configuration.origin, name: 'sign_in', value: '', maxAgeSeconds: 0 }),
  );

  return authPage({
    title: 'Signed in',
    content: `<p>You are signed in as ${escapeHtml({ value: user.login })}. <a href="${escapeHtml({ value: destination })}">Continue</a>.</p>`,
    headers,
  });
}
