import { Effect, Option } from 'effect';
import type { SavedEval } from '../application-types.ts';
import { readEval } from '../store/application-store.ts';
import type { EvalRunFailure } from '../types.ts';
import { evalInspection } from './eval-inspection.ts';
import type { InspectionOptions } from './eval-inspection.ts';
import type { EvalInspection } from './inspection-schemas.ts';
import { readHistoricalEval } from './read-historical-eval.ts';

type InspectEvalInput = InspectionOptions & { readonly outFolder: string };
type ReadOptionalEvalInput = { readonly outFolder: string };

/** Reads saved stages or historical reports without credentials, a runtime, or record writes. */
export const inspectEval = Effect.fn('inspectEval')(function* ({
  outFolder,
  caseId,
  projectGrade,
}: InspectEvalInput): Effect.fn.Return<EvalInspection, EvalRunFailure> {
  const saved = yield* readOptionalEval({ outFolder }).pipe(
    Effect.catchTags({ EvalManifestMissing: () => Effect.succeedNone }),
  );

  if (Option.isNone(saved)) {
    return yield* readHistoricalEval({ outFolder, caseId });
  }

  return evalInspection({ saved: saved.value, caseId, projectGrade });
});

const readOptionalEval = Effect.fn('readOptionalEval')(function* ({
  outFolder,
}: ReadOptionalEvalInput): Effect.fn.Return<Option.Option<SavedEval>, EvalRunFailure> {
  const saved = yield* readEval({ outFolder });

  return Option.some(saved);
});
