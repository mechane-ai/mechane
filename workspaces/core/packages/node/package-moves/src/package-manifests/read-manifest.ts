import { InputUnreadable, readText } from '@mechane/checks-kernel';
import type { Member } from '@mechane/checks-kernel';
import { Effect, Schema } from 'effect';
import { posix } from 'node:path';
import { PACKAGE_MANIFEST } from '../constants.ts';
import { ManifestDependencies } from './schemas.ts';
import type { ReadManifest } from './types.ts';

/** A package manifest whole, whose every key the step keeps as it stands but its dependencies. */
const Manifest = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown));

/** A member as it stands before the step. */
type ReadManifestInput = { readonly member: Member };

/** Reads a member's manifest before the step, whole and as its dependencies. */
export const readManifest = Effect.fn('readManifest')(function* ({
  member,
}: ReadManifestInput): Effect.fn.Return<ReadManifest, InputUnreadable> {
  const path = posix.join(member.folder, PACKAGE_MANIFEST);

  const manifest = yield* Schema.decodeUnknownEffect(Manifest)(yield* readText({ path })).pipe(
    Effect.mapError((error) => new InputUnreadable({ path, reason: error.message })),
  );

  const declared = yield* Schema.decodeUnknownEffect(ManifestDependencies)(manifest).pipe(
    Effect.mapError((error) => new InputUnreadable({ path, reason: error.message })),
  );

  return { member, manifest, declared };
});
