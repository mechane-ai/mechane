import { SourcePublicationStatus } from '@mechane/protocol';
import { Option, Result } from 'effect';
import { captureSourcePatch } from './capture-source-patch.ts';
import { recordSourcePublication } from './record-source-publication.ts';
import type { ExistingPublicationInput, PublicationSource } from './types.ts';

/** Freezes exactly the selected bytes before a write credential is minted. */
export async function capturePublication({
  mech,
  owner,
  sandbox,
  source,
  publication,
}: ExistingPublicationInput): Promise<Result.Result<Option.Option<PublicationSource>, string>> {
  if (Option.isSome(publication.changes)) {
    const existing = Option.some(source);

    return Result.succeed(existing);
  }

  const patch = await captureSourcePatch({ mech, owner, sandbox, source, publication });

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
