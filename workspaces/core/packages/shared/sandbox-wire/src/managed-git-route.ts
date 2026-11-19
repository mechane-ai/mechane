import { HttpHeader, HttpMethod } from '@mechane/records';
import { Option, Schema } from 'effect';
import { ManagedWorkerSession } from './managed-work.ts';

const GitPackService = { Upload: 'git-upload-pack', Receive: 'git-receive-pack' } as const;
const GitService = Schema.Enum(GitPackService);
export type GitService = typeof GitService.Type;

const gitResourcePattern = Schema.isPattern(/^sesrsc_[A-Za-z0-9_-]{1,128}$/u);
const GitResourceId = Schema.String.check(gitResourcePattern);
const SessionId = ManagedWorkerSession.fields.sessionId;
const GitRefsPath = 'info/refs';

const RESOURCE_ROUTE = /^\/__mechane\/git\/([^/]+)\/([^/]+)\/(info\/refs|git-upload-pack|git-receive-pack)$/u;
const IDENTITY_ROUTE = /^\/__mechane\/git\/([^/]+)\/identity$/u;

export type GitOperation = {
  readonly sessionId: typeof SessionId.Type;
  readonly resourceId: typeof GitResourceId.Type;
  readonly path: string;
  readonly service: GitService;
  readonly isAdvertisement: boolean;
};

export type GitIdentityRequest = { readonly isIdentity: true; readonly sessionId: typeof SessionId.Type };
type IncomingGitRequest = { readonly request: Request };

/** Parses the Git smart HTTP request before transport or session authorization. */
export function readGitOperation({ request }: IncomingGitRequest): Option.Option<GitOperation | GitIdentityRequest> {
  const url = new URL(request.url);
  const body = Option.fromNullishOr(request.body);
  const bodyless = Option.isNone(body);
  const identityMatch = IDENTITY_ROUTE.exec(url.pathname);
  const identity = Option.fromNullishOr(identityMatch);

  const canReadIdentity = request.method === HttpMethod.Get && bodyless && url.search === '';

  if (Option.isSome(identity) && canReadIdentity) {
    const [, sessionId] = identity.value;

    if (Schema.is(SessionId)(sessionId)) {
      return Option.some({ isIdentity: true, sessionId });
    }
  }

  const parts = RESOURCE_ROUTE.exec(url.pathname);
  const match = Option.fromNullishOr(parts);

  if (Option.isNone(match)) {
    return Option.none();
  }

  const [, sessionId, resourceId, path] = match.value;

  if (!Schema.is(SessionId)(sessionId) || !Schema.is(GitResourceId)(resourceId)) {
    return Option.none();
  }

  if (path === GitRefsPath && request.method === HttpMethod.Get) {
    const service = url.searchParams.get('service');

    if (url.searchParams.size === 1 && Schema.is(GitService)(service) && bodyless) {
      return Option.some({ sessionId, resourceId, path, service, isAdvertisement: true });
    }
  }

  if (request.method !== HttpMethod.Post || !Schema.is(GitService)(path) || url.search !== '') {
    return Option.none();
  }

  const contentType = request.headers.get(HttpHeader.ContentType);
  const expected = `application/x-${path}-request`;

  if (contentType !== expected || request.headers.has('content-encoding')) {
    return Option.none();
  }

  return Option.some({ sessionId, resourceId, path, service: path, isAdvertisement: false });
}
