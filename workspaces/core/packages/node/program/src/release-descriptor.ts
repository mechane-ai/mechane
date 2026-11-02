import '../../../../licenses/semver.js';
import { Release } from '@mechane/protocol';
import { GitCommit, SHA256_PATTERN } from '@mechane/records';
import { Effect, Option, Record, Schema } from 'effect';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { lt, valid } from 'semver';
import { MIGRATION_LOCK, WIRE_LOCK } from './constants.ts';
import { lostEntries } from './locks/lost-entries.ts';
import { Lock } from './schemas.ts';

/** The exact bytes of a runtime artifact, independent of its distribution or hosting platform. */
export const ArtifactDigest = Schema.Struct({
  sha256: Schema.String.check(Schema.isPattern(SHA256_PATTERN)),
  bytes: Schema.Int.check(Schema.isGreaterThan(0)),
});

export type ArtifactDigest = typeof ArtifactDigest.Type;

const completeFormatLock = Schema.makeFilter(
  (lock: Lock) => {
    const entries = Record.toEntries(lock);

    return (
      entries.length > 0 &&
      entries.every(([name, values]) => {
        const distinct = new Set(values);

        return (
          name.trim().length > 0 && values.every((value) => value.trim().length > 0) && distinct.size === values.length
        );
      })
    );
  },
  { expected: 'a complete format map with distinct, nonempty entries' },
);

const FormatLock = Lock.check(completeFormatLock);

const semanticVersion = Schema.makeFilter(
  (version: string) => {
    const parsed = valid(version);
    const known = Option.fromNullishOr(parsed);

    return Option.isSome(known);
  },
  { expected: 'a semantic version' },
);

/** Both local packages and cloud manifests carry these same release and compatibility facts. */
export const ReleaseDescriptor = Schema.Struct({
  version: Release.check(semanticVersion),
  public_commit: GitCommit,
  worker: ArtifactDigest,
  formats: Schema.Struct({ wire: FormatLock, migrations: FormatLock }),
});

export type ReleaseDescriptor = typeof ReleaseDescriptor.Type;

/** A source build cannot establish its complete stored-format baseline. */
class ReleaseDescriptorUnreadable extends Schema.TaggedError<ReleaseDescriptorUnreadable>()(
  'ReleaseDescriptorUnreadable',
  { path: Schema.String, reason: Schema.String },
) {}

type ReadReleaseDescriptorInput = {
  readonly root: string;
  readonly version: Release;
  readonly commit: string;
  readonly worker: ArtifactDigest;
};

/** Reads the same shipped format locks for source startup and both distribution formats. */
export const readReleaseDescriptor = Effect.fn('readReleaseDescriptor')(function* ({
  root,
  version,
  commit,
  worker,
}: ReadReleaseDescriptorInput): Effect.fn.Return<ReleaseDescriptor, ReleaseDescriptorUnreadable> {
  const wirePath = join(root, WIRE_LOCK);
  const migrationPath = join(root, MIGRATION_LOCK);
  const wire = yield* readFormatLock({ path: wirePath });
  const migrations = yield* readFormatLock({ path: migrationPath });

  return { version, public_commit: commit, worker, formats: { wire, migrations } };
});

type FormatLockInput = { readonly path: string };

const readFormatLock = Effect.fn('readFormatLock')(function* ({
  path,
}: FormatLockInput): Effect.fn.Return<Lock, ReleaseDescriptorUnreadable> {
  const text = yield* Effect.tryPromise({
    try: () => readFile(path, 'utf8'),
    catch: (cause) => new ReleaseDescriptorUnreadable({ path, reason: String(cause) }),
  });

  const codec = Schema.fromJsonString(FormatLock);

  return yield* Schema.decodeUnknownEffect(codec)(text).pipe(
    Effect.mapError(() => new ReleaseDescriptorUnreadable({ path, reason: 'the format lock is invalid' })),
  );
});

type ReleaseCompatibilityInput = { readonly previous: ReleaseDescriptor; readonly candidate: ReleaseDescriptor };

/** Admission is forward-only and preserves complete categories, including categories with no entries yet. */
export function releaseCompatibilityIssue({ previous, candidate }: ReleaseCompatibilityInput): Option.Option<string> {
  if (lt(candidate.version, previous.version)) {
    return Option.some('release downgrades are not supported; publish compatible recovery code as a newer release');
  }

  for (const kind of ['wire', 'migrations'] as const) {
    const locked = previous.formats[kind];
    const current = candidate.formats[kind];
    const categories = Record.keys(locked);
    const missingCategory = categories.find((name) => !Record.has(current, name));
    const missing = Option.fromNullishOr(missingCategory);
    const removed = lostEntries({ locked, current });

    if (Option.isSome(missing) || removed.length > 0) {
      return Option.some(`the candidate removes or changes recorded ${kind} categories or entries`);
    }
  }

  return Option.none();
}
