import { SourceCompletion } from '@mechane/protocol';
import { Schema } from 'effect';
import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { HistoryImportFailed } from './errors.ts';
import type { ImportScopeSummary } from './export-history.ts';

const RetirementArchive = Schema.StructWithRest(
  Schema.Struct({
    /** Absent when the retired environment has no completion receipts to preserve. */
    environmentCompletions: Schema.optionalKey(Schema.Array(SourceCompletion)),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);

export type RetirementEvidence = {
  readonly sha256: string;
  readonly environmentCompletions: ReadonlyArray<SourceCompletion>;
};

type ReadRetirementEvidenceInput = {
  readonly path: string;
  readonly expectedSha256: string;
  readonly scopes: ReadonlyArray<ImportScopeSummary>;
};

export async function readRetirementEvidence({
  path,
  expectedSha256,
  scopes,
}: ReadRetirementEvidenceInput): Promise<RetirementEvidence> {
  const file = await open(path, 'r');

  try {
    const metadata = await file.stat();

    if (!metadata.isFile()) {
      throw new HistoryImportFailed({ reason: 'The reviewed retirement receipt must be a regular file' });
    }

    const bytes = await file.readFile();
    const sha256 = createHash('sha256').update(bytes).digest('hex');

    if (sha256 !== expectedSha256) {
      throw new HistoryImportFailed({ reason: 'The retirement receipt differs from its reviewed digest' });
    }

    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);

    const decoded = Schema.decodeUnknownResult(Schema.fromJsonString(RetirementArchive), { onExcessProperty: 'error' })(
      text,
    );

    if (decoded._tag === 'Failure') {
      throw new HistoryImportFailed({ reason: 'The retirement receipt must contain a valid JSON evidence object' });
    }

    const environmentCompletions = decoded.success.environmentCompletions ?? [];
    const identities = new Set<string>();

    for (const completion of environmentCompletions) {
      const isSelected = scopes.some(
        (scope) => scope.workspaceId === completion.workspaceId && scope.mechId === completion.mechId,
      );

      if (!isSelected) {
        throw new HistoryImportFailed({ reason: 'A retirement completion belongs to an unselected workspace or mech' });
      }

      const identity = `${completion.workspaceId}/${completion.mechId}/${completion.executionId}`;

      if (identities.has(identity)) {
        throw new HistoryImportFailed({ reason: 'The retirement receipt repeats a scoped completion identity' });
      }

      identities.add(identity);
    }

    return { sha256, environmentCompletions };
  } finally {
    await file.close();
  }
}
