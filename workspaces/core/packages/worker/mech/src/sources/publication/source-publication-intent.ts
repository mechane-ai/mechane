import type { SourcePublication } from '@mechane/mech-store';
import { SourcePublicationStatus } from '@mechane/protocol';
import { DateTime, Option, Result } from 'effect';
import type { PublicationIntentInput } from './types.ts';

/** A source UUID names one owner-selected publication intent for all retries. */
export function sourcePublicationIntent({
  source,
  request,
  principalId,
}: PublicationIntentInput): Result.Result<SourcePublication, string> {
  const existing = source.publication;

  if (Option.isSome(existing)) {
    const paths = JSON.stringify(existing.value.paths);
    const selected = JSON.stringify(request.paths);

    if (existing.value.title !== request.title || existing.value.body !== request.body || paths !== selected) {
      return Result.fail('source publication already holds another immutable intent');
    }

    return Result.succeed(existing.value);
  }

  const publication: SourcePublication = {
    title: request.title,
    body: request.body,
    paths: request.paths,
    createdAt: DateTime.nowUnsafe(),
    creatorId: principalId,
    status: SourcePublicationStatus.Capturing,
    changes: Option.none(),
    commit: Option.none(),
    hasAttemptedPull: false,
    pullRequestUrl: Option.none(),
    reason: Option.none(),
  };

  return Result.succeed(publication);
}
