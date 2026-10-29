import { jsonFileText, PrivateMode, replaceFile, StepSubject } from '@mechane/program';
import { Effect, Option } from 'effect';
import { join } from 'node:path';
import { StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import { CELLD_OWNER_FILE } from './constants.ts';
import { CelldOwner } from './schemas.ts';

type WriteCelldOwnerInput = { readonly projectFolder: string; readonly owner: CelldOwner };

/** Atomically records the runtime owner inside the private staged project. */
export const writeCelldOwner = Effect.fn('writeCelldOwner')(function* ({
  projectFolder,
  owner,
}: WriteCelldOwnerInput): Effect.fn.Return<void, StackFailed> {
  const path = join(projectFolder, CELLD_OWNER_FILE);
  const subjects = [StepSubject.cases.Path.make({ path })];
  const contents = jsonFileText({ schema: CelldOwner, value: owner });
  const accept = Option.none();

  yield* replaceFile({ path, contents, mode: PrivateMode.File, accept }).pipe(
    Effect.mapError(
      (failure) => new StackFailed({ step: StackStep.WriteLocalState, subjects, reason: failure.reason }),
    ),
  );
});
