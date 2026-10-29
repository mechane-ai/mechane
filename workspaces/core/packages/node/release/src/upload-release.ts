import {
  exitStatusText,
  finishedProcess,
  startProcess,
  StepSubject,
  SUCCESS_STATUS,
  writeResult,
} from '@mechane/program';
import { ManifestKey, ReleaseKey, ReleaseManifest } from '@mechane/protocol';
import { Effect, Option, Schema } from 'effect';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cleanRevision } from './clean-revision.ts';
import { EMPTY_DOTENV, MISSING_OBJECT_ERROR, ReleaseStep, UPLOAD_TIMEOUT, WRANGLER } from './constants.ts';
import { ReleaseFailed } from './errors.ts';
import { releaseFiles } from './release-files.ts';
import type { BucketKeyInput, BuiltFromTreeInput, UploadReleaseInput } from './types.ts';

/**
 * Uploads built releases to production's bucket with Wrangler, each file at its key and the latest manifest last, so a
 * failed upload leaves the latest release as it was. It refuses a folder built from a revision other than the clean
 * working tree's, and a release whose manifest the bucket holds, since a published release's files never change. Only
 * an operator on a trusted host runs it; no check does.
 */
export function uploadRelease({
  directory,
  bucket,
  inherited,
}: UploadReleaseInput): Effect.Effect<void, ReleaseFailed> {
  return Effect.gen(function* () {
    yield* builtFromTree({ folder: directory, inherited });

    const files = yield* releaseFiles({ folder: directory });

    for (const { key } of files.filter((file) => Schema.is(ManifestKey)(file.key))) {
      if (yield* isKeyPublished({ bucket, key, inherited })) {
        return yield* new ReleaseFailed({
          step: ReleaseStep.CheckUnpublished,
          subjects: [StepSubject.cases.BucketObject.make({ bucket, key })],
          reason: 'the bucket holds that release, whose files never change; build a later release',
        });
      }
    }

    for (const { key, path } of files) {
      const subjects = [StepSubject.cases.Path.make({ path }), StepSubject.cases.BucketObject.make({ bucket, key })];

      yield* finishedProcess({
        command: WRANGLER,
        args: ['r2', 'object', 'put', `${bucket}/${key}`, '--file', path, '--remote', ...EMPTY_DOTENV],
        environment: inherited,
        timeout: UPLOAD_TIMEOUT,
      }).pipe(Effect.mapError(({ reason }) => new ReleaseFailed({ step: ReleaseStep.UploadFile, subjects, reason })));
      writeResult({ line: `uploaded ${bucket}/${key}` });
    }
  });
}

/** Fails unless the folder's latest manifest names the clean working tree's revision as the one it was built from. */
function builtFromTree({ folder, inherited }: BuiltFromTreeInput): Effect.Effect<void, ReleaseFailed> {
  const latest = join(folder, ReleaseKey.Latest);
  const subjects = [StepSubject.cases.Path.make({ path: latest })];

  return Effect.gen(function* () {
    const revision = yield* cleanRevision({ inherited });

    const text = yield* Effect.tryPromise({
      try: () => readFile(latest, 'utf8'),
      catch: (cause) => new ReleaseFailed({ step: ReleaseStep.ReadLatest, subjects, reason: String(cause) }),
    });

    const manifest = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(ReleaseManifest))(text).pipe(
      Effect.mapError((error) => new ReleaseFailed({ step: ReleaseStep.ReadLatest, subjects, reason: error.message })),
    );

    if (manifest.revision !== revision) {
      return yield* new ReleaseFailed({
        step: ReleaseStep.MatchRevision,
        subjects: [StepSubject.cases.Revision.make({ revision: manifest.revision })],
        reason: `the working tree is at ${revision}; build the release from it again`,
      });
    }
  });
}

/** Whether the bucket holds an object at `key`; Wrangler reports a key that does not exist on standard error. */
export function isKeyPublished({ bucket, key, inherited }: BucketKeyInput): Effect.Effect<boolean, ReleaseFailed> {
  const subjects = [StepSubject.cases.BucketObject.make({ bucket, key })];

  const get = startProcess({
    command: WRANGLER,
    args: ['r2', 'object', 'get', `${bucket}/${key}`, '--remote', '--pipe', ...EMPTY_DOTENV],
    environment: inherited,
    timeout: UPLOAD_TIMEOUT,
  });

  return Effect.scoped(get.pipe(Effect.flatMap(({ exited }) => exited))).pipe(
    Effect.mapError(({ reason }) => new ReleaseFailed({ step: ReleaseStep.ReadBucketKey, subjects, reason })),
    Effect.filterOrFail(
      ({ status, stderr }) => Option.contains(status, SUCCESS_STATUS) || stderr.includes(MISSING_OBJECT_ERROR),
      ({ status, stderr }) =>
        new ReleaseFailed({
          step: ReleaseStep.ReadBucketKey,
          subjects,
          reason: `it exited ${exitStatusText({ status })}: ${stderr.trim()}`,
        }),
    ),
    Effect.map(({ status }) => Option.contains(status, SUCCESS_STATUS)),
  );
}
