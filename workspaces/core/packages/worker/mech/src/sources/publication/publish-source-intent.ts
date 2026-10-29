import { ensureSourceBranch } from '@mechane/integrations';
import type { SourcePublication } from '@mechane/mech-store';
import { Option, Result } from 'effect';
import { commitSourceIntent } from './commit-source-intent.ts';
import { recordSourcePublication } from './record-source-publication.ts';
import { resolveSourcePublication } from './resolve-source-publication.ts';
import type { PublicationSource, PublishSourceIntentInput } from './types.ts';

/** Publishes the recorded commit under its stable branch, then resolves exactly one draft. */
export async function publishSourceIntent({
  mech,
  owner,
  sandbox,
  source,
  token,
}: PublishSourceIntentInput): Promise<PublicationSource> {
  const committed = await commitSourceIntent({ mech, owner, sandbox, source, token });
  const existing = committed.publication;

  if (Option.isNone(existing)) {
    return committed;
  }

  const publication = existing.value;

  if (Option.isNone(publication.commit)) {
    return committed;
  }

  const pull = sourcePullRequest({ mech, source: committed, token, publication, commit: publication.commit.value });

  const branch = await ensureSourceBranch(pull);

  if (Result.isFailure(branch)) {
    const failed = { ...publication, reason: Option.some(branch.failure.reason) };

    return await recordSourcePublication({ mech, source: committed, publication: failed });
  }

  const next = await resolveSourcePublication({ mech, source: committed, publication, pull });

  return await recordSourcePublication({ mech, source: committed, publication: next });
}

type SourcePullRequestInput = Pick<PublishSourceIntentInput, 'mech' | 'source' | 'token'> & {
  readonly publication: SourcePublication;
  readonly commit: string;
};

function sourcePullRequest({
  mech,
  source,
  token,
  publication,
  commit,
}: SourcePullRequestInput): Parameters<typeof ensureSourceBranch>[0] {
  return {
    origin: mech.settings.githubApiOrigin,
    token,
    grant: source.grant,
    sourceId: source.sourceId,
    commit,
    title: publication.title,
    body: publication.body,
    webOrigin: mech.settings.githubWebOrigin,
  };
}
