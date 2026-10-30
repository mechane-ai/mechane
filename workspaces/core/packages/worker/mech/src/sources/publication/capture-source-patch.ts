import type { SourcePublishPaths } from '@mechane/protocol';
import type { SourceChanges } from '@mechane/records';
import { SourceCapture, SourceGuestAnswer } from '@mechane/sandbox-wire';
import { Option, Result, Schema } from 'effect';
import { admitSourceMachine } from '../configuration/admit-source-machine.ts';
import { isSourceGranted } from '../context/is-source-granted.ts';
import { captureMatchesIntent } from './capture-matches-intent.ts';
import { captureWithinLimit } from './capture-within-limit.ts';
import type { ExistingPublicationInput } from './types.ts';

type CapturedPatchInput = { readonly encoded: unknown; readonly paths: SourcePublishPaths };

/** Captures only the owner's selected paths after rechecking the grant and reserving sandbox capacity. */
export async function captureSourcePatch({
  mech,
  owner,
  sandbox,
  source,
  publication,
}: ExistingPublicationInput): Promise<Result.Result<Option.Option<SourceChanges>, string>> {
  const capture = Schema.encodeSync(SourceCapture)({
    sourceId: source.sourceId,
    commit: source.commit,
    paths: publication.paths,
  });

  const context = { mech, owner, source, sandbox };
  const isGranted = await isSourceGranted(context);

  if (!isGranted) {
    return Result.fail('the repository grant changed before capture');
  }

  const refusal = await admitSourceMachine(context);

  if (Option.isSome(refusal)) {
    return Result.fail(refusal.value);
  }

  const encoded = await sandbox.captureSource({ capture });

  return capturedPatch({ encoded, paths: publication.paths });
}

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
