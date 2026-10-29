import { readOptionalFile, StepSubject } from '@mechane/program';
import { Effect, Option, Result, Schema } from 'effect';
import { join } from 'node:path';
import { StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import { CELLD_OWNER_FILE } from './constants.ts';
import { removeCelldOwner } from './remove-celld-owner.ts';
import { CelldOwner } from './schemas.ts';

const MISSING_PROCESS_CODE = 'ESRCH';

const UNCONFIRMED_OWNER =
  'a previous startup was interrupted; remove this ownership file only after confirming its celld processes have stopped';

const MissingProcess = Schema.Struct({ code: Schema.Literal(MISSING_PROCESS_CODE) });
const CelldOwnerJson = Schema.fromJsonString(CelldOwner);
type VerifyCelldStoppedInput = { readonly projectFolder: string };

/** Blocks state reuse while celld processes remain alive or an interrupted startup leaves ownership uncertain. */
export const verifyCelldStopped = Effect.fn('verifyCelldStopped')(function* ({
  projectFolder,
}: VerifyCelldStoppedInput): Effect.fn.Return<void, StackFailed> {
  const path = join(projectFolder, CELLD_OWNER_FILE);
  const step = StackStep.LockLocalState;
  const subjects = [StepSubject.cases.Path.make({ path })];

  const contents = yield* readOptionalFile({ path }).pipe(
    Effect.mapError((failure) => new StackFailed({ step, subjects, reason: failure.reason })),
  );

  if (Option.isNone(contents)) {
    return;
  }

  const owner = yield* Schema.decodeUnknownEffect(CelldOwnerJson)(contents.value).pipe(
    Effect.mapError(() => new StackFailed({ step, subjects, reason: 'the runtime ownership record is invalid' })),
  );

  if (!owner.isReady || owner.processGroups.length === 0) {
    return yield* new StackFailed({ step, subjects, reason: UNCONFIRMED_OWNER });
  }

  if (owner.processGroups.some(isGroupRunning)) {
    const groups = owner.processGroups.join(', ');

    return yield* new StackFailed({
      step,
      subjects,
      reason: `celld still owns this state in process groups ${groups}; stop those processes before retrying`,
    });
  }

  yield* removeCelldOwner({ projectFolder });
});

const isGroupRunning: (processGroup: number) => boolean = (processGroup) => {
  const signal = Result.try(() => process.kill(-processGroup, 0));

  if (Result.isSuccess(signal)) {
    return true;
  }

  return !Schema.is(MissingProcess)(signal.failure);
};
