import { Effect, Schema } from 'effect';
import type { Option } from 'effect';
import { join } from 'node:path';
import type { EvalTrial } from '../application-schemas.ts';
import type { Json } from '../application-types.ts';
import type { EvalFileFailed } from '../errors.ts';
import { onceFile } from './once-file.ts';

type ReadHistoricalReportInput = { readonly outFolder: string };
type ReadHistoricalTrialInput = ReadHistoricalReportInput & Pick<EvalTrial, 'caseId' | 'repeat'>;
type HistoricalReportPathInput = ReadHistoricalReportInput;
type HistoricalTrialPathInput = ReadHistoricalTrialInput;

export const readHistoricalReport = Effect.fn('readHistoricalReport')(function* ({
  outFolder,
}: ReadHistoricalReportInput): Effect.fn.Return<Option.Option<Json>, EvalFileFailed> {
  const path = historicalReportPath({ outFolder });
  const file = onceFile({ path, schema: Schema.Json });

  return yield* file.read();
});

export const readHistoricalTrial = Effect.fn('readHistoricalTrial')(function* ({
  outFolder,
  caseId,
  repeat,
}: ReadHistoricalTrialInput): Effect.fn.Return<Option.Option<Json>, EvalFileFailed> {
  const path = historicalTrialPath({ outFolder, caseId, repeat });
  const file = onceFile({ path, schema: Schema.Json });

  return yield* file.read();
});

function historicalReportPath({ outFolder }: HistoricalReportPathInput): string {
  return join(outFolder, 'report.json');
}

function historicalTrialPath({ outFolder, caseId, repeat }: HistoricalTrialPathInput): string {
  return join(outFolder, `${caseId}-${repeat}.json`);
}
