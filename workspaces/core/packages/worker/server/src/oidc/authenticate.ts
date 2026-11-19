import type { ControlStore, ManagedScope } from '@mechane/control-store';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import { ManagedHttpError } from '../managed/http-error.ts';
import { oidcIdentity } from './claims.ts';
import type { ManagedIdentitySettings } from './settings.ts';
import { verifyOidcToken } from './verification.ts';

type Authenticate = {
  readonly request: Request;
  readonly settings: ManagedIdentitySettings;
  readonly workspace: { readonly workspaceId: string; readonly workspaceName: string; readonly dailyCapMicros: number };
  readonly store: Pick<ControlStore, 'auth'>;
};

export async function authenticateManagedOidc({
  request,
  settings,
  workspace,
  store,
}: Authenticate): Promise<ManagedScope | null> {
  if (settings.length === 0) {
    return null;
  }

  const raw = request.headers.get(HttpHeader.Authorization) ?? '';
  const match = /^Bearer ([-_a-z0-9]+\.[-_a-z0-9]+\.[-_a-z0-9]+)$/iu.exec(raw);
  const token = match?.[1];

  if (token === undefined) {
    return null;
  }

  const verified = await verifyOidcToken({ token, issuers: settings });
  const identity = oidcIdentity(verified);

  if (identity === null) {
    throw new ManagedHttpError(HttpStatusCode.Unauthorized, 'Invalid OpenID Connect subject');
  }

  if (identity.role === undefined) {
    throw new ManagedHttpError(HttpStatusCode.Forbidden, 'OpenID Connect token holds no role');
  }

  const principalId = await store.auth.resolveManagedOidcPrincipal({
    ...workspace,
    issuer: verified.issuer.issuer_url,
    name: verified.issuer.name,
    subjectClaim: identity.subjectClaim,
    subject: identity.subject,
  });

  const scope = { workspaceId: workspace.workspaceId, principalId, isAdmin: identity.role === 'admin' };

  if (identity.sharesActorSubject) {
    return { ...scope, actorIdentity: { issuer: verified.issuer.issuer_url, subject: identity.subject } };
  }

  return scope;
}
