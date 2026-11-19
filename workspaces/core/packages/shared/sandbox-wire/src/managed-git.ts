import { boundedText } from '@mechane/records';
import { Schema } from 'effect';
import type { ManagedWorkerSession } from './managed-work.ts';

const GIT_AUTHOR_MAX_BYTES = 256;
const authorCharacters = Schema.isPattern(/^[^\r\n<>]+$/u);
const AuthorField = boundedText({ maxBytes: GIT_AUTHOR_MAX_BYTES }).check(authorCharacters);

export const ManagedGitIdentity = Schema.Struct({ commitAuthorName: AuthorField, commitAuthorEmail: AuthorField });

type GitIdentityPath = Pick<typeof ManagedWorkerSession.Type, 'sessionId'>;

export function managedGitIdentityPath({ sessionId }: GitIdentityPath): string {
  return `/__mechane/git/${encodeURIComponent(sessionId)}/identity`;
}
