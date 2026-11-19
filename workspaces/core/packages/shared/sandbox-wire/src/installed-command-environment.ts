import { Option } from 'effect';
import type { ManagedWorkerSession } from './managed-work.ts';

const path = /^\/internal\/managed\/sessions\/(sesn_[A-Za-z0-9_-]{1,128})\/command-environment$/u;

export function matchInstalledCommandEnvironment({ pathname }: Pick<URL, 'pathname'>): Option.Option<string> {
  const match = path.exec(pathname);

  return Option.fromNullishOr(match).pipe(Option.flatMap((groups) => Option.fromNullishOr(groups[1])));
}

export function installedCommandEnvironmentPath({
  sessionId,
}: Pick<typeof ManagedWorkerSession.Type, 'sessionId'>): string {
  return `/internal/managed/sessions/${encodeURIComponent(sessionId)}/command-environment`;
}
