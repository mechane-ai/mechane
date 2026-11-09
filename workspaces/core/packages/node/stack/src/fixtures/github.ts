import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import { Record } from 'effect';
import { randomBytes } from 'node:crypto';
import type { GitHubFixture, GitHubUser } from '../types.ts';
import { startHttpService, text } from './http.ts';
import type { HttpService } from './http.ts';

const USERS = {
  owner: { id: 1001, login: 'mechane-owner' },
  member: { id: 1002, login: 'mechane-member' },
  outsider: { id: 1003, login: 'mechane-outsider' },
} as const;

const CREDENTIAL_BYTES = 32;

export type StartedGitHub = { readonly fixture: GitHubFixture; readonly close: HttpService['close'] };

export async function startGitHubFixture(callbackOrigin: URL): Promise<StartedGitHub> {
  const clientId = 'mechane-local';
  const clientSecret = randomBytes(CREDENTIAL_BYTES).toString('hex');
  const callback = new URL('/auth/github/callback', callbackOrigin).href;
  const codes = new Map<string, GitHubUser>();
  const tokens = new Map<string, GitHubUser>();

  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);

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

  return { fixture: { origin: service.origin, clientId, clientSecret, users: USERS }, close: service.close };
}
