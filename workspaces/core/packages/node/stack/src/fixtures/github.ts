import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import { Record, Schema } from 'effect';
import { generateKeyPairSync, randomBytes, verify } from 'node:crypto';
import type { GitHubFixture, GitHubInstallationToken, GitHubUser } from '../types.ts';
import { startHttpService, text } from './http.ts';
import type { HttpService } from './http.ts';

const USERS = {
  owner: { id: 1001, login: 'mechane-owner' },
  member: { id: 1002, login: 'mechane-member' },
  outsider: { id: 1003, login: 'mechane-outsider' },
} as const;

const APP_ID = 201;
const INSTALLATION_ID = 301;
const REPOSITORY_ID = 401;
const APP_ASSERTION_MAX_AGE_SECONDS = 600;
const CREDENTIAL_BYTES = 32;
const ASSERTION_PARTS = 3;
const MILLISECONDS_PER_SECOND = 1000;
const RSA_MODULUS_BITS = 2048;

const GitHubTokenRequest = Schema.Struct({
  repository_ids: Schema.Array(Schema.Number),
  permissions: Schema.Record(Schema.String, Schema.String),
});

const AssertionHeader = Schema.Struct({ alg: Schema.Literal('RS256') });
const AssertionClaims = Schema.Struct({ iss: Schema.String, exp: Schema.Number, iat: Schema.Number });

export type StartedGitHub = { readonly fixture: GitHubFixture; readonly close: HttpService['close'] };

export async function startGitHubFixture(callbackOrigin: URL): Promise<StartedGitHub> {
  const clientId = 'mechane-local';
  const clientSecret = randomBytes(CREDENTIAL_BYTES).toString('hex');
  const callback = new URL('/auth/github/callback', callbackOrigin).href;
  const codes = new Map<string, GitHubUser>();
  const tokens = new Map<string, GitHubUser>();
  const appTokens = new Map<string, GitHubInstallationToken>();
  const appKeys = generateKeyPairSync('rsa', { modulusLength: RSA_MODULUS_BITS });
  const privateKey = appKeys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

  function isAppAssertion(request: Request): boolean {
    const token = request.headers.get(HttpHeader.Authorization)?.replace(/^Bearer /u, '') ?? '';
    const parts = token.split('.');
    const [headerPart, payloadPart, signaturePart] = parts;
    const hasAssertionParts = headerPart !== undefined && payloadPart !== undefined && signaturePart !== undefined;

    if (parts.length !== ASSERTION_PARTS || !hasAssertionParts) {
      return false;
    }

    const header = Schema.decodeUnknownResult(Schema.fromJsonString(AssertionHeader))(
      Buffer.from(headerPart, 'base64url').toString('utf8'),
    );

    const claims = Schema.decodeUnknownResult(Schema.fromJsonString(AssertionClaims))(
      Buffer.from(payloadPart, 'base64url').toString('utf8'),
    );

    if (header._tag === 'Failure' || claims._tag === 'Failure') {
      return false;
    }

    const now = Date.now() / MILLISECONDS_PER_SECOND;

    const hasValidLifetime =
      claims.success.iat <= now &&
      claims.success.exp > now &&
      claims.success.exp - claims.success.iat <= APP_ASSERTION_MAX_AGE_SECONDS;

    if (claims.success.iss !== String(APP_ID) || !hasValidLifetime) {
      return false;
    }

    return verify(
      'RSA-SHA256',
      Buffer.from(`${headerPart}.${payloadPart}`),
      appKeys.publicKey,
      Buffer.from(signaturePart, 'base64url'),
    );
  }

  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (
      url.pathname === githubInstallationTokenPath({ installationId: INSTALLATION_ID }) &&
      request.method === HttpMethod.Post
    ) {
      if (!isAppAssertion(request)) {
        return Response.json({ message: 'Invalid App assertion' }, { status: HttpStatusCode.Unauthorized });
      }

      const parsed = Schema.decodeUnknownResult(Schema.fromJsonString(GitHubTokenRequest))(await request.text());

      if (
        parsed._tag === 'Failure' ||
        parsed.success.repository_ids.length !== 1 ||
        parsed.success.repository_ids[0] !== REPOSITORY_ID
      ) {
        return Response.json({ message: 'Repository access refused' }, { status: HttpStatusCode.Forbidden });
      }

      const value = `ghs_${randomBytes(CREDENTIAL_BYTES).toString('hex')}`;
      const permissions = { ...parsed.success.permissions, metadata: 'read' };

      appTokens.set(value, {
        value,
        repositoryIds: parsed.success.repository_ids,
        permissions,
        issuedAt: Date.now(),
        revokedAt: null,
      });

      return Response.json({ token: value, permissions, repositories: [{ id: REPOSITORY_ID }] });
    }

    if (url.pathname === '/installation/token' && request.method === HttpMethod.Delete) {
      const value = request.headers.get(HttpHeader.Authorization)?.replace(/^Bearer /u, '') ?? '';
      const token = appTokens.get(value);

      if (token === undefined || token.revokedAt !== null) {
        return Response.json({ message: 'Bad credentials' }, { status: HttpStatusCode.Unauthorized });
      }

      appTokens.set(value, { ...token, revokedAt: Date.now() });

      return new Response(null, { status: HttpStatusCode.NoContent });
    }

    if (url.pathname === '/login/oauth/authorize' && request.method === HttpMethod.Get) {
      if (url.searchParams.get('client_id') !== clientId || url.searchParams.get('redirect_uri') !== callback) {
        return Response.json({ error: 'Invalid OAuth client' }, { status: HttpStatusCode.BadRequest });
      }

      const options = Record.values(USERS)
        .map((user) => `<option value="${user.login}">${user.login}</option>`)
        .join('');

      const html = `<!doctype html><html><title>Local GitHub</title><form method="post"><label>GitHub account<select name="login">${options}</select></label><button>Sign in</button></form></html>`;

      return new Response(html, { headers: { [HttpHeader.ContentType]: MediaType.Html } });
    }

    if (url.pathname === '/login/oauth/authorize' && request.method === HttpMethod.Post) {
      if (url.searchParams.get('client_id') !== clientId || url.searchParams.get('redirect_uri') !== callback) {
        return Response.json({ error: 'Invalid OAuth client' }, { status: HttpStatusCode.BadRequest });
      }

      const form = new URLSearchParams(await request.text());
      const user = Record.values(USERS).find((candidate) => candidate.login === form.get('login'));
      const state = url.searchParams.get('state');

      if (user === undefined || state === null) {
        return Response.json({ error: 'Unknown GitHub account or state' }, { status: HttpStatusCode.BadRequest });
      }

      const code = randomBytes(CREDENTIAL_BYTES).toString('hex');

      codes.set(code, user);

      const redirect = new URL(callback);

      redirect.searchParams.set('code', code);
      redirect.searchParams.set('state', state);

      return Response.redirect(redirect, HttpStatusCode.SeeOther);
    }

    if (url.pathname === '/login/oauth/access_token' && request.method === HttpMethod.Post) {
      const form = new URLSearchParams(await request.text());
      const user = codes.get(form.get('code') ?? '');

      if (form.get('client_id') !== clientId || form.get('client_secret') !== clientSecret || user === undefined) {
        return Response.json({ error: 'bad_verification_code' }, { status: HttpStatusCode.BadRequest });
      }

      codes.delete(form.get('code') ?? '');

      const token = `gho_${randomBytes(CREDENTIAL_BYTES).toString('hex')}`;

      tokens.set(token, user);

      return Response.json({ access_token: token, token_type: 'bearer', scope: 'read:user' });
    }

    if (url.pathname === '/user' && request.method === HttpMethod.Get) {
      const authorization = request.headers.get(HttpHeader.Authorization) ?? '';
      const token = authorization.replace(/^(?:Bearer|token) /iu, '');
      const user = tokens.get(token);

      if (user === undefined) {
        return Response.json({ message: 'Bad credentials' }, { status: HttpStatusCode.Unauthorized });
      }

      return Response.json({ id: user.id, login: text(user.login) });
    }

    return Response.json({ error: 'Unknown GitHub fixture route' }, { status: HttpStatusCode.NotFound });
  }

  const service = await startHttpService(handle);

  const app = {
    id: APP_ID,
    installationId: INSTALLATION_ID,
    repositoryId: REPOSITORY_ID,
    privateKey,
    readTokens: () => [...appTokens.values()],
  };

  return { fixture: { origin: service.origin, clientId, clientSecret, users: USERS, app }, close: service.close };
}

type GitHubInstallation = { readonly installationId: number };

function githubInstallationTokenPath({ installationId }: GitHubInstallation): string {
  return `/app/installations/${encodeURIComponent(String(installationId))}/access_tokens`;
}
