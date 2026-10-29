import {
  checkRefusals,
  DeployFailed,
  DeployStep,
  gitSucceeds,
  PROGRAM,
  RELEASE_TAG,
  runGit,
} from '@mechane/deploy-kernel';
import type { SettingsInput } from '@mechane/deploy-kernel';
import { StepSubject, writeDiagnostic } from '@mechane/program';
import { RELEASE } from '@mechane/protocol';
import { Effect } from 'effect';

/** Checks that the checkout is clean and that `HEAD` is this source's release tag. */
export function checkCheckout({ settings }: SettingsInput): Effect.Effect<void, DeployFailed> {
  return runGit({ args: ['status', '--porcelain'], settings }).pipe(
    Effect.filterOrFail(
      (changes) => changes === '',
      () =>
        new DeployFailed({
          step: DeployStep.CheckCleanTree,
          reason: 'it lists uncommitted or untracked files; commit or remove them',
        }),
    ),
    Effect.tap(() =>
      Effect.sync(() =>
        writeDiagnostic({ program: PROGRAM, line: 'clean tree: git status --porcelain prints nothing' }),
      ),
    ),
    Effect.andThen(checkReleaseTag({ settings })),
  );
}

/**
 * Checks that `HEAD` carries this source's release tag, annotated, as `git describe` names a revision only by one, that
 * `origin` holds the same tag, and that `origin/main` holds `HEAD`. Every refusal it finds is named at once.
 */
function checkReleaseTag({ settings }: SettingsInput): Effect.Effect<void, DeployFailed> {
  const step = DeployStep.CheckReleaseTag;
  const subjects = [StepSubject.cases.Tag.make({ tag: RELEASE_TAG })];
  const peeled = `refs/tags/${RELEASE_TAG}^{}`;

  return Effect.gen(function* () {
    const described = yield* runGit({ args: ['describe', '--exact-match', 'HEAD'], settings }).pipe(
      Effect.mapError(({ reason }) => new DeployFailed({ step, subjects, reason })),
    );

    const head = yield* runGit({ args: ['rev-parse', 'HEAD'], settings });
    const peeledHead = `${head.trim()}\t${peeled}`;
    const remote = yield* runGit({ args: ['ls-remote', 'origin', peeled], settings });

    yield* runGit({ args: ['fetch', '--quiet', 'origin', 'main'], settings });

    const isOnMain = yield* gitSucceeds({ args: ['merge-base', '--is-ancestor', 'HEAD', 'origin/main'], settings });

    yield* checkRefusals({
      step,
      subjects,
      refusals: [
        {
          isRefused: described.trim() !== RELEASE_TAG,
          reason: `HEAD is ${described.trim()}, where this source releases ${RELEASE}`,
        },
        { isRefused: remote.trim() !== peeledHead, reason: `origin's annotated ${RELEASE_TAG} does not peel to HEAD` },
        { isRefused: !isOnMain, reason: 'origin/main does not contain HEAD' },
      ],
    });
    writeDiagnostic({ program: PROGRAM, line: `tag: HEAD is ${RELEASE_TAG}, as origin holds it, on origin/main` });
  });
}
