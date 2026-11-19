import { Effect, Option, Schema } from 'effect';
import { join } from 'node:path';
import type { EvalTrial } from '../application-schemas.ts';
import type { Json } from '../application-types.ts';
import type { EvalFileFailed } from '../errors.ts';
import { readNumberedRecords } from './application-store.ts';
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

type ArchivedTrialInput = ReadHistoricalReportInput & Pick<EvalTrial, 'id'>;

/** Historical records are opened for inspection only. The allowlist excludes writer files and unrecognized paths. */
export const readArchivedTrialFiles = Effect.fn('readArchivedTrialFiles')(function* ({
  outFolder,
  id,
}: ArchivedTrialInput): Effect.fn.Return<Readonly<Record<string, Json>>, EvalFileFailed> {
  const folder = join(outFolder, 'trials', id);
  const files: Record<string, Json> = {};

  const names = [
    'subject-intent.json',
    'subject-receipt.json',
    'subject-notification.json',
    'subject.json',
    'evidence.json',
    'judge-intent.json',
    'judge-receipt.json',
    'judge-notification.json',
    'judge.json',
    'grade-submission.json',
    'grade.json',
    'subject-connection.json',
    'judge-connection.json',
  ];

  for (const name of names) {
    const path = join(folder, name);
    const raw = yield* onceFile({ path, schema: Schema.Json }).read();

    if (Option.isSome(raw)) {
      files[name] = raw.value;
    }
  }

  for (const dir of ['cleanup', 'failures', 'observations', 'judge-observations']) {
    const path = join(folder, dir);
    const entries = yield* readNumberedRecords({ folder: path, schema: Schema.Json });

    if (entries.length > 0) {
      files[dir] = [...entries];
    }
  }

  return files;
});
