import {
  artifactDigest,
  jsonFileText,
  PrivateMode,
  readOptionalFile,
  releaseCompatibilityIssue,
  ReleaseDescriptor,
  replaceFile,
  StepSubject,
} from '@mechane/program';
import { Effect, Option, Schema } from 'effect';
import type { Scope } from 'effect';
import { join } from 'node:path';
import { StackStep, STAGED_FILES } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import type { RuntimeProject } from '../types.ts';
import { LOCAL_APPLICATION, LOCAL_FILES } from './constants.ts';
import { localStateEntries } from './local-state-entries.ts';
import { LocalState, RecognizedLocalStateJson } from './schemas.ts';

type LocalStateManifestInput = {
  readonly stateFolder: string;
  readonly projectFolder: string;
  readonly origin: URL;
  readonly project: RuntimeProject;
  /** Absent unless an older installation needs its previous release established from a published manifest. */
  readonly adoptionManifest: Option.Option<string>;
};

/** Records admission before startup, so an interrupted upgrade cannot admit an older release afterward. */
export const localStateManifest = Effect.fn('localStateManifest')(function* ({
  stateFolder,
  projectFolder,
  origin,
  project,
  adoptionManifest,
}: LocalStateManifestInput): Effect.fn.Return<void, StackFailed, Scope.Scope> {
  const path = join(stateFolder, LOCAL_FILES.manifest);
  const subjects = [StepSubject.cases.Path.make({ path })];
  const step = StackStep.ReadLocalState;

  const contents = yield* readOptionalFile({ path }).pipe(
    Effect.mapError((failure) => new StackFailed({ step, subjects, reason: failure.reason })),
  );

  if (Option.isSome(contents)) {
    const manifest = yield* Schema.decodeUnknownEffect(RecognizedLocalStateJson)(contents.value).pipe(
      Effect.mapError(() => new StackFailed({ step, subjects, reason: 'the local state manifest is invalid' })),
    );

    if (manifest.origin.origin !== origin.origin) {
      return yield* new StackFailed({
        step,
        subjects,
        reason: `this state belongs to ${manifest.origin.origin}; keep MECHANE_LOCAL_ORIGIN unchanged`,
      });
    }

    const previous = yield* previousLocalRelease({
      manifest,
      projectFolder,
      candidate: project.release,
      adoptionManifest,
    });

    const issue = releaseCompatibilityIssue({ previous, candidate: project.release });

    if (Option.isSome(issue)) {
      return yield* new StackFailed({ step, subjects, reason: issue.value });
    }
  } else {
    const entries = yield* localStateEntries({ stateFolder, step });

    if (entries.length > 0) {
      return yield* new StackFailed({
        step,
        subjects,
        reason: 'the directory is not empty and has no Mechane state manifest',
      });
    }
  }

  const value: LocalState = { application: LOCAL_APPLICATION, origin, release: project.release };
  const next = jsonFileText({ schema: LocalState, value });

  const accept = Option.none();

  yield* replaceFile({ path, contents: next, mode: PrivateMode.File, accept }).pipe(
    Effect.mapError(
      (failure) => new StackFailed({ step: StackStep.WriteLocalState, subjects, reason: failure.reason }),
    ),
  );
});

type PreviousLocalReleaseInput = {
  readonly manifest: typeof RecognizedLocalStateJson.Type;
  readonly projectFolder: string;
  readonly candidate: ReleaseDescriptor;
  /** Absent when recorded metadata or identical Worker bytes establish the previous release. */
  readonly adoptionManifest: Option.Option<string>;
};

const previousLocalRelease = Effect.fn('previousLocalRelease')(function* ({
  manifest,
  projectFolder,
  candidate,
  adoptionManifest,
}: PreviousLocalReleaseInput): Effect.fn.Return<ReleaseDescriptor, StackFailed> {
  if (manifest.application === LOCAL_APPLICATION) {
    return manifest.release;
  }

  const path = join(projectFolder, STAGED_FILES.bundle);
  const step = StackStep.ReadLocalState;
  const subjects = [StepSubject.cases.Path.make({ path })];

  const stored = yield* artifactDigest({ path }).pipe(
    Effect.mapError(
      () =>
        new StackFailed({
          step,
          subjects,
          reason: 'legacy state has no verifiable Worker bundle; restore its original staged bundle before adoption',
        }),
    ),
  );

  if (stored.sha256 === candidate.worker.sha256 && stored.bytes === candidate.worker.bytes) {
    return candidate;
  }

  if (Option.isNone(adoptionManifest)) {
    return yield* new StackFailed({
      step,
      subjects,
      reason:
        "legacy state needs its previous release metadata; set MECHANE_LOCAL_ADOPTION_MANIFEST to that release's installation.json before upgrading",
    });
  }

  const baselinePath = adoptionManifest.value;

  const contents = yield* readOptionalFile({ path: baselinePath }).pipe(
    Effect.mapError((failure) => new StackFailed({ step, subjects, reason: failure.reason })),
  );

  if (Option.isNone(contents)) {
    return yield* new StackFailed({ step, subjects, reason: 'the adoption manifest does not exist' });
  }

  const codec = Schema.fromJsonString(ReleaseDescriptor);

  const previous = yield* Schema.decodeUnknownEffect(codec)(contents.value).pipe(
    Effect.mapError(
      () =>
        new StackFailed({
          step,
          subjects,
          reason: 'the adoption manifest lacks valid release and compatibility metadata',
        }),
    ),
  );

  if (previous.worker.sha256 !== stored.sha256 || previous.worker.bytes !== stored.bytes) {
    return yield* new StackFailed({
      step,
      subjects,
      reason: 'the adoption manifest does not match the existing Worker bytes',
    });
  }

  return previous;
});
