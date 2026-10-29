import { SourcePublicationStatus, SourceStatus } from '@mechane/protocol';
import { SourceAnswer } from '@mechane/rpc';
import { Option, Result } from 'effect';
import { isSourceGranted } from '../context/is-source-granted.ts';
import { sourceAnswer } from '../context/source-answer.ts';
import type { SourceTaskInput } from '../types.ts';
import { advancePublication } from './advance-publication.ts';
import { capturePublication } from './capture-publication.ts';
import { recordSourcePublication } from './record-source-publication.ts';
import { sourcePublicationIntent } from './source-publication-intent.ts';
import type { ExistingPublicationInput, PublicationIntentInput } from './types.ts';

type PublishSourceInput = SourceTaskInput & Omit<PublicationIntentInput, 'source'>;

const TERMINAL_STATUSES: ReadonlySet<SourcePublicationStatus> = new Set([
  SourcePublicationStatus.Published,
  SourcePublicationStatus.Rejected,
]);

/** Only an owner call can freeze and advance this source's single draft intent. */
export async function publishSource({
  mech,
  owner,
  sandbox,
  source,
  request,
  principalId,
}: PublishSourceInput): Promise<SourceAnswer> {
  const context = { mech, owner, sandbox, source };
  const isGranted = await isSourceGranted(context);

  if (source.status !== SourceStatus.Ready || !isGranted) {
    return SourceAnswer.cases.Refused.make({
      reason: 'source checkout is not ready under its current repository grant',
    });
  }

  const intent = sourcePublicationIntent({ source, request, principalId });

  if (Result.isFailure(intent)) {
    return SourceAnswer.cases.Refused.make({ reason: intent.failure });
  }

  const publication = intent.success;
  const current = await recordSourcePublication({ mech, source, publication });

  if (TERMINAL_STATUSES.has(publication.status)) {
    return sourceAnswer({ source: current });
  }

  return await publishCapturedSource({ ...context, source: current, publication });
}

async function publishCapturedSource({
  mech,
  owner,
  sandbox,
  source,
  publication,
}: ExistingPublicationInput): Promise<SourceAnswer> {
  const context = { mech, owner, sandbox, source };
  const captured = await capturePublication({ ...context, publication });

  if (Result.isFailure(captured)) {
    return SourceAnswer.cases.Refused.make({ reason: captured.failure });
  }

  if (Option.isNone(captured.success)) {
    return sourceAnswer({ source });
  }

  const next = await advancePublication({ ...context, source: captured.success.value });

  return sourceAnswer({ source: next });
}
