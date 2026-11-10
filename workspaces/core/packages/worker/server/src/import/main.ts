import { Redacted } from 'effect';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyHistory } from './apply.ts';
import { IMPORT_USAGE } from './arguments.ts';
import { HistoryImportFailed } from './errors.ts';
import { exportHistory } from './export-history.ts';
import type { ImportScopeSummary } from './export-history.ts';
import { failImport, writeImportOutput } from './output.ts';
import { loadImportCommand, loadImportSettings } from './settings.ts';

type ImportSummary = {
  readonly version: number;
  readonly mode: string;
  readonly digest: string;
  readonly scopes: ReadonlyArray<ImportScopeSummary>;
  readonly retirementEvidenceSha256: string | null;
};

async function runImport(): Promise<void> {
  const { invocation, environment } = loadImportCommand();

  if (invocation.mode === 'help') {
    writeImportOutput({ line: IMPORT_USAGE });

    return;
  }

  const settings = loadImportSettings({ environment, mode: invocation.mode });
  const databaseUrl = Redacted.value(settings.databaseUrl);
  const directory = await mkdtemp(join(tmpdir(), 'mechane-history-import-'));

  try {
    const plan = await exportHistory({ databaseUrl, selection: invocation.selection, directory });

    const summary: ImportSummary = {
      version: 1,
      mode: invocation.mode,
      digest: plan.digest,
      scopes: plan.scopes.map((scope) => scope.summary),
      retirementEvidenceSha256: null,
    };

    if (invocation.mode === 'apply') {
      const hasReviewedEvidence =
        invocation.expectedDigest !== null &&
        invocation.retirementReceipt !== null &&
        invocation.retirementSha256 !== null;

      if (!hasReviewedEvidence || settings.target === null) {
        throw new HistoryImportFailed({ reason: 'The reviewed source and retirement evidence are required for apply' });
      }

      const retirementEvidenceSha256 = await applyHistory({
        plan,
        databaseUrl,
        origin: settings.target.origin,
        serviceKey: Redacted.value(settings.target.serviceKey),
        expectedDigest: invocation.expectedDigest,
        retirementReceipt: invocation.retirementReceipt,
        retirementSha256: invocation.retirementSha256,
      });

      writeImportOutput({ line: JSON.stringify({ ...summary, retirementEvidenceSha256 }) });

      return;
    }

    writeImportOutput({ line: JSON.stringify(summary) });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  try {
    await runImport();
  } catch (error) {
    if (error instanceof HistoryImportFailed) {
      failImport({ line: error.reason });

      return;
    }

    failImport({
      line: 'The historical import failed; preserve the source and rerun the same reviewed import after resolving the failure',
    });
  }
}

await main();
