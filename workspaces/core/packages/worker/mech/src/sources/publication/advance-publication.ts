import { createGitHubToken, GITHUB_TOKEN_PERMISSION, revokeGitHubToken } from '@mechane/integrations';
import type { MechTables, SourcePublication, SourceTask } from '@mechane/mech-store';
import { capturePromise } from '@mechane/utilities';
import { DateTime, Option, Result } from 'effect';
import type { Redacted } from 'effect';
import { publishSourceIntent } from './publish-source-intent.ts';
import { recordSourcePublication } from './record-source-publication.ts';
import type { SourcePublicationInput } from './types.ts';

type SourcePublicationCredential = { readonly token: Redacted.Redacted; readonly expiresAt: DateTime.Utc };

type PublicationCredentialInput = SourcePublicationInput & {
  readonly credential: SourcePublicationCredential;
  readonly publication: SourcePublication;
};

/** Write credentials stay in the Worker and are revoked after every observed publication outcome. */
export async function advancePublication({
  mech,
  owner,
  sandbox,
  source,
}: SourcePublicationInput): Promise<SourceTask> {
  const existing = source.publication;

  if (Option.isNone(existing)) {
    return source;
  }

  const token = await createGitHubToken({
    origin: mech.settings.githubApiOrigin,
    settings: mech.settings,
    workspaceId: owner.workspaceId,
    grant: source.grant,
    permission: GITHUB_TOKEN_PERMISSION.Write,
  });

  if (Result.isFailure(token)) {
    const publication = { ...existing.value, reason: Option.some(token.failure.reason) };

    return await recordSourcePublication({ mech, source, publication });
  }

  const credential = { token: token.success.token, expiresAt: token.success.expires_at };

  return await publishWithCredential({ mech, owner, sandbox, source, credential, publication: existing.value });
}

async function publishWithCredential({
  mech,
  owner,
  sandbox,
  source,
  credential,
  publication: original,
}: PublicationCredentialInput): Promise<SourceTask> {
  const { token, expiresAt } = credential;
  const promise = publishSourceIntent({ mech, owner, sandbox, source, token });
  const outcome = await capturePromise({ promise });
  const isRevoked = await revokeGitHubToken({ origin: mech.settings.githubApiOrigin, token });

  if (Result.isSuccess(outcome) && isRevoked) {
    return outcome.success;
  }

  const run: (store: MechTables) => Option.Option<SourceTask> = (store) =>
    store.sourceTask({ sourceId: source.sourceId });

  const recorded = await mech.store.atomic({ run });
  const unchanged: () => SourceTask = () => source;
  const current = Option.getOrElse(recorded, unchanged);

  let reason = 'publication was interrupted; retry resumes the recorded intent';

  if (!isRevoked) {
    const deadline = DateTime.formatIso(expiresAt);
    reason = `GitHub credential revocation was not confirmed; the credential expires at ${deadline}`;
  }

  const fallback: () => typeof original = () => original;
  const existing = Option.getOrElse(current.publication, fallback);
  const publication = { ...existing, reason: Option.some(reason) };

  return await recordSourcePublication({ mech, source: current, publication });
}
