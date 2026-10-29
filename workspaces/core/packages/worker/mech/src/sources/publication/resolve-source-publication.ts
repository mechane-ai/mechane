import { createSourcePull, reconcileSourcePull } from '@mechane/integrations';
import type { ensureSourceBranch } from '@mechane/integrations';
import type { SourcePublication, SourceTask } from '@mechane/mech-store';
import { SourcePublicationStatus } from '@mechane/protocol';
import { Option, Result } from 'effect';
import type { OpenedMech } from '../../types.ts';
import { recordSourcePublication } from './record-source-publication.ts';

type SourcePullContext = {
  readonly mech: OpenedMech;
  readonly source: SourceTask;
  readonly publication: SourcePublication;
  readonly pull: Parameters<typeof ensureSourceBranch>[0];
};

const UNCERTAIN_CREATION = 'draft creation is uncertain; retries only reconcile the recorded branch';

/** An uncertain PR request is reconciled forever and is never posted a second time. */
export async function resolveSourcePublication({
  mech,
  source,
  publication,
  pull,
}: SourcePullContext): Promise<SourcePublication> {
  const existing = await reconcileSourcePull(pull);

  if (Result.isFailure(existing)) {
    return { ...publication, reason: Option.some(existing.failure.reason) };
  }

  if (Option.isSome(existing.success)) {
    return {
      ...publication,
      status: SourcePublicationStatus.Published,
      pullRequestUrl: existing.success,
      reason: Option.none(),
    };
  }

  if (publication.hasAttemptedPull) {
    return { ...publication, status: SourcePublicationStatus.Uncertain, reason: Option.some(UNCERTAIN_CREATION) };
  }

  return await createAttemptedPull({ mech, source, publication, pull });
}

async function createAttemptedPull({ mech, source, publication, pull }: SourcePullContext): Promise<SourcePublication> {
  const attempted = { ...publication, hasAttemptedPull: true };

  await recordSourcePublication({ mech, source, publication: attempted });

  const created = await createSourcePull(pull);

  if (Result.isSuccess(created)) {
    return {
      ...attempted,
      status: SourcePublicationStatus.Published,
      pullRequestUrl: Option.some(created.success),
      reason: Option.none(),
    };
  }

  return { ...attempted, status: SourcePublicationStatus.Uncertain, reason: Option.some(UNCERTAIN_CREATION) };
}
