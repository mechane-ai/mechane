import { SourcePublicationStatus } from '@mechane/protocol';
import type { SourcePublishPaths } from '@mechane/protocol';
import type { SourceChanges } from '@mechane/records';
import { SourceCapture, SourceGuestAnswer } from '@mechane/sandbox-wire';
import { Option, Result, Schema } from 'effect';
import { captureMatchesIntent } from './capture-matches-intent.ts';
import { captureWithinLimit } from './capture-within-limit.ts';
import { recordSourcePublication } from './record-source-publication.ts';
import type { ExistingPublicationInput, PublicationSource } from './types.ts';

/** Freezes exactly the selected bytes before a write credential is minted. */
export async function capturePublication({
  mech,
  sandbox,
  source,
  publication,
}: ExistingPublicationInput): Promise<Result.Result<Option.Option<PublicationSource>, string>> {
  if (Option.isSome(publication.changes)) {
    const existing = Option.some(source);

    return Result.succeed(existing);
  }

  const capture = Schema.encodeSync(SourceCapture)({
    sourceId: source.sourceId,
    commit: source.commit,
    paths: publication.paths,
  });

  const encoded = await sandbox.captureSource({ capture });
  const patch = capturedPatch({ encoded, paths: publication.paths });

  if (Result.isFailure(patch)) {
    return Result.fail(patch.failure);
  }

  if (Option.isNone(patch.success)) {
    const pending = Option.none<PublicationSource>();

    return Result.succeed(pending);
  }

  const captured = { ...publication, changes: patch.success, status: SourcePublicationStatus.Committing };
  const frozen = await recordSourcePublication({ mech, source, publication: captured });
  const some = Option.some(frozen);

  return Result.succeed(some);
}

type CapturedPatchInput = { readonly encoded: unknown; readonly paths: SourcePublishPaths };

function capturedPatch({ encoded, paths }: CapturedPatchInput): Result.Result<Option.Option<SourceChanges>, string> {
  const decoded = Schema.decodeUnknownResult(SourceGuestAnswer)(encoded);

  if (Result.isFailure(decoded)) {
    return Result.fail('source guest returned an invalid captured patch');
  }

  const answer = decoded.success;

  if (SourceGuestAnswer.guards.Pending(answer)) {
    const pending = Option.none<SourceChanges>();

    return Result.succeed(pending);
  }

  if (!SourceGuestAnswer.guards.Changes(answer)) {
    return Result.fail('source patch could not be captured');
  }

  if (!captureMatchesIntent({ changes: answer.changes, paths }) || !captureWithinLimit({ changes: answer.changes })) {
    return Result.fail('source capture differs from the owner-selected bounded patch');
  }

  const captured = Option.some(answer.changes);

  return Result.succeed(captured);
}
