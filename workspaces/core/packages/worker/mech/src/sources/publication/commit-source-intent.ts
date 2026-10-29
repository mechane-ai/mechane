import { commitGitHubSource } from '@mechane/integrations';
import type { SourcePublication } from '@mechane/mech-store';
import { SourcePublicationStatus } from '@mechane/protocol';
import type { SourceChanges } from '@mechane/records';
import { Option, Result } from 'effect';
import { recordSourcePublication } from './record-source-publication.ts';
import type { PublicationSource, PublishSourceIntentInput } from './types.ts';

/** Git objects are deterministic from the frozen patch, date, title and original parent. */
export async function commitSourceIntent({
  mech,
  source,
  token,
}: PublishSourceIntentInput): Promise<PublicationSource> {
  const existing = source.publication;

  if (Option.isNone(existing)) {
    return source;
  }

  const publication = existing.value;

  if (Option.isSome(publication.commit)) {
    return source;
  }

  if (Option.isNone(publication.changes)) {
    return source;
  }

  const changes = publication.changes.value;

  const request = sourceCommitRequest({ mech, source, token, publication, changes });
  const commit = await commitGitHubSource(request);

  if (Result.isFailure(commit)) {
    const failed = { ...publication, reason: Option.some(commit.failure.reason) };

    return await recordSourcePublication({ mech, source, publication: failed });
  }

  const committed = { ...publication, commit: Option.some(commit.success), status: SourcePublicationStatus.Publishing };

  return await recordSourcePublication({ mech, source, publication: committed });
}

type SourceCommitRequestInput = Pick<PublishSourceIntentInput, 'mech' | 'source' | 'token'> & {
  readonly publication: SourcePublication;
  readonly changes: SourceChanges;
};

function sourceCommitRequest({
  mech,
  source,
  token,
  publication,
  changes,
}: SourceCommitRequestInput): Parameters<typeof commitGitHubSource>[0] {
  return {
    origin: mech.settings.githubApiOrigin,
    token,
    grant: source.grant,
    sourceId: source.sourceId,
    baseCommit: source.commit,
    changes,
    title: publication.title,
    createdAt: publication.createdAt,
  };
}
