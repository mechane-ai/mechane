import { MECH_HISTORY_IMPORT_BATCH_MAX_BYTES, MechHistoryImport, MechHistorySourceKind } from '@mechane/protocol';
import { Schema } from 'effect';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import type { ImportBatchFile } from './batches.ts';
import { HistoryImportFailed } from './errors.ts';
import type { ImportScopeSummary, PreparedImport, PreparedScope } from './export-history.ts';
import type { RetirementEvidence } from './retirement.ts';

const UUID_PREFIX_END = 8;
const UUID_SECOND_END = 12;
const UUID_VERSION_INDEX = 13;
const UUID_THIRD_END = 16;
const UUID_VARIANT_INDEX = 17;
const UUID_FOURTH_END = 20;
const UUID_END = 32;

type DeliveryBatchFile = {
  readonly path: string;
  readonly digest: string;
  readonly sourceSequence: number;
  readonly isFinal: boolean;
};

export type DeliveryScope = { readonly summary: ImportScopeSummary; readonly files: ReadonlyArray<DeliveryBatchFile> };

type PrepareDeliveryInput = { readonly plan: PreparedImport; readonly evidence: RetirementEvidence };
type PrepareScopeInput = { readonly scope: PreparedScope; readonly evidence: RetirementEvidence };

type PrepareBatchInput = {
  readonly scope: ImportScopeSummary;
  readonly file: ImportBatchFile;
  readonly evidence: RetirementEvidence;
};

type RequestIdInput = {
  readonly sourceDigest: string;
  readonly sourceSequence: number;
  readonly retirementSha256: string;
  readonly mechId: string;
};

function requestId(input: RequestIdInput): string {
  const digest = createHash('sha256').update(JSON.stringify(input)).digest('hex');

  return `${digest.slice(0, UUID_PREFIX_END)}-${digest.slice(UUID_PREFIX_END, UUID_SECOND_END)}-5${digest.slice(UUID_VERSION_INDEX, UUID_THIRD_END)}-a${digest.slice(UUID_VARIANT_INDEX, UUID_FOURTH_END)}-${digest.slice(UUID_FOURTH_END, UUID_END)}`;
}

async function prepareBatch({ scope, file, evidence }: PrepareBatchInput): Promise<DeliveryBatchFile> {
  const text = await readFile(file.path, 'utf8');

  if (createHash('sha256').update(text).digest('hex') !== file.digest) {
    throw new HistoryImportFailed({ reason: 'A prepared history batch changed before delivery' });
  }

  const decoded = Schema.decodeUnknownResult(Schema.fromJsonString(MechHistoryImport), { onExcessProperty: 'error' })(
    text,
  );

  if (decoded._tag === 'Failure') {
    throw new HistoryImportFailed({ reason: 'A prepared history batch cannot be decoded' });
  }

  const batch = decoded.success;
  const history = [...batch.history];

  if (batch.sourceSequence === 1) {
    history.push({ kind: MechHistorySourceKind.Retirement, record: { sha256: evidence.sha256 } });
  }

  if (batch.isFinal) {
    const completions = evidence.environmentCompletions.filter(
      (completion) => completion.workspaceId === scope.workspaceId && completion.mechId === scope.mechId,
    );

    const archives = completions.map((record) => ({ kind: MechHistorySourceKind.Completion, record }));

    history.push(...archives);
  }

  const body = JSON.stringify({
    ...Schema.encodeSync(MechHistoryImport)(batch),
    requestId: requestId({
      sourceDigest: scope.sourceDigest,
      sourceSequence: batch.sourceSequence,
      retirementSha256: evidence.sha256,
      mechId: scope.mechId,
    }),
    sourceDigest: scope.sourceDigest,
    history,
  });

  if (new TextEncoder().encode(body).byteLength > MECH_HISTORY_IMPORT_BATCH_MAX_BYTES) {
    throw new HistoryImportFailed({ reason: 'An enriched history batch exceeds its authenticated transport bound' });
  }

  const path = `${file.path}.delivery`;

  await writeFile(path, body, { mode: 0o600, flag: 'wx' });

  return {
    path,
    digest: createHash('sha256').update(body).digest('hex'),
    sourceSequence: batch.sourceSequence,
    isFinal: batch.isFinal,
  };
}

async function prepareScope({ scope, evidence }: PrepareScopeInput): Promise<DeliveryScope> {
  const files: Array<DeliveryBatchFile> = [];

  for (const file of scope.files) {
    const preparedFile = await prepareBatch({ scope: scope.summary, file, evidence });

    files.push(preparedFile);
  }

  return { summary: scope.summary, files };
}

export async function prepareDelivery({ plan, evidence }: PrepareDeliveryInput): Promise<ReadonlyArray<DeliveryScope>> {
  const prepared: Array<DeliveryScope> = [];

  for (const scope of plan.scopes) {
    const preparedScope = await prepareScope({ scope, evidence });

    prepared.push(preparedScope);
  }

  return prepared;
}
