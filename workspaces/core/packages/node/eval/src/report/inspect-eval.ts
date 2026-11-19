import { Effect, Option } from 'effect';
import type { EvalFileFailed } from '../errors.ts';
import { readEval } from '../store/application-store.ts';
import type { EvalRunFailure } from '../types.ts';
import { evalInspection } from './eval-inspection.ts';
import type { InspectionOptions } from './eval-inspection.ts';
import type { EvalInspection } from './inspection-schemas.ts';
import { readArchivedStages } from './read-archived-stages.ts';
import { readHistoricalEval } from './read-historical-eval.ts';

type InspectEvalInput = InspectionOptions & { readonly outFolder: string };

/** Reads saved stages or historical reports without credentials, a runtime, or record writes. */
export const inspectEval = Effect.fn('inspectEval')(function* ({
  outFolder,
  caseId,
  projectGrade,
}: InspectEvalInput): Effect.fn.Return<EvalInspection, EvalRunFailure> {
  const readCurrent = Effect.fn('readCurrent')(function* (): Effect.fn.Return<EvalInspection, EvalRunFailure> {
    const saved = yield* readEval({ outFolder });

    return evalInspection({ saved, caseId, projectGrade });
  });

  const readArchived = Effect.fn('readArchived')(function* (
    failure: EvalFileFailed,
  ): Effect.fn.Return<EvalInspection, EvalRunFailure> {
    const found = yield* readArchivedStages({ outFolder, caseId, projectGrade });

    if (Option.isSome(found)) {
      return found.value;
    }

    return yield* failure;
  });

  return yield* readCurrent().pipe(
    Effect.catchTags({
      EvalManifestMissing: () => readHistoricalEval({ outFolder, caseId }),
      EvalFileFailed: (failure) => readArchived(failure),
    }),
  );
});
