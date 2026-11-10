import { openImportedHistory } from '@mechane/control-store';
import { MECH_HISTORY_IMPORT_PATH, MechHistoryImportReceipt } from '@mechane/protocol';
import { HttpHeader, HttpMethod, MediaType } from '@mechane/records';
import { Schema } from 'effect';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { prepareDelivery } from './delivery.ts';
import type { DeliveryScope } from './delivery.ts';
import { HistoryImportFailed } from './errors.ts';
import type { ImportScopeSummary, PreparedImport } from './export-history.ts';
import { readRetirementEvidence } from './retirement.ts';

const IMPORT_REQUEST_TIMEOUT_MILLISECONDS = 30_000;
const IMPORT_RECEIPT_MAX_BYTES = 4096;

type ApplyHistoryInput = {
  readonly plan: PreparedImport;
  readonly databaseUrl: string;
  readonly origin: URL;
  readonly serviceKey: string;
  readonly expectedDigest: string;
  readonly retirementReceipt: string;
  readonly retirementSha256: string;
};

type SourceFenceInput = { readonly databaseUrl: string; readonly scope: ImportScopeSummary };
type ReadReceiptInput = { readonly response: Response };
type ApplyScopeInput = { readonly scope: DeliveryScope };

async function requireSourceFence({ databaseUrl, scope }: SourceFenceInput): Promise<void> {
  const source = await openImportedHistory({ databaseUrl });

  try {
    const fence = await source.getExportFence(scope);

    if (!fence.scope.isWorkspaceSuspended) {
      throw new HistoryImportFailed({
        reason: `The source maintenance fence was removed for workspace ${scope.workspaceId}`,
      });
    }
  } finally {
    await source.close();
  }
}

async function readReceipt({ response }: ReadReceiptInput): Promise<MechHistoryImportReceipt> {
  const reader = response.body?.getReader();

  if (reader === undefined) {
    throw new HistoryImportFailed({ reason: 'The import acknowledgment has no body; rerun the same reviewed import' });
  }

  const chunks: Array<Uint8Array> = [];
  const state = { bytes: 0, isDone: false };

  try {
    while (!state.isDone) {
      const chunk = await reader.read();

      if (chunk.done) {
        state.isDone = true;
      } else {
        const bytes = Schema.decodeUnknownSync(Schema.Uint8Array)(chunk.value);

        state.bytes += bytes.byteLength;

        if (state.bytes > IMPORT_RECEIPT_MAX_BYTES) {
          await reader.cancel();

          throw new HistoryImportFailed({ reason: 'The import acknowledgment exceeds its bound' });
        }

        chunks.push(bytes);
      }
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(state.bytes);
  const cursor = { offset: 0 };

  for (const chunk of chunks) {
    bytes.set(chunk, cursor.offset);

    cursor.offset += chunk.byteLength;
  }

  const text = new TextDecoder().decode(bytes);

  const decoded = Schema.decodeUnknownResult(Schema.fromJsonString(MechHistoryImportReceipt), {
    onExcessProperty: 'error',
  })(text);

  if (decoded._tag === 'Failure') {
    throw new HistoryImportFailed({ reason: 'The import acknowledgment is invalid; rerun the same reviewed import' });
  }

  return decoded.success;
}

export async function applyHistory({
  plan,
  databaseUrl,
  origin,
  serviceKey,
  expectedDigest,
  retirementReceipt,
  retirementSha256,
}: ApplyHistoryInput): Promise<string> {
  if (plan.digest !== expectedDigest) {
    throw new HistoryImportFailed({ reason: 'The preserved source differs from the reviewed dry-run digest' });
  }

  const evidence = await readRetirementEvidence({
    path: retirementReceipt,
    expectedSha256: retirementSha256,
    scopes: plan.scopes.map(({ summary }) => summary),
  });

  const scopes = await prepareDelivery({ plan, evidence });
  const importUrl = new URL(MECH_HISTORY_IMPORT_PATH, origin);

  async function applyScope({ scope }: ApplyScopeInput): Promise<void> {
    for (const file of scope.files) {
      const body = await readFile(file.path, 'utf8');

      if (createHash('sha256').update(body).digest('hex') !== file.digest) {
        throw new HistoryImportFailed({ reason: 'A prepared delivery batch changed before delivery' });
      }

      await requireSourceFence({ databaseUrl, scope: scope.summary });

      const response = await fetch(importUrl, {
        method: HttpMethod.Post,
        headers: { [HttpHeader.Authorization]: `Bearer ${serviceKey}`, [HttpHeader.ContentType]: MediaType.Json },
        redirect: 'error',
        signal: AbortSignal.timeout(IMPORT_REQUEST_TIMEOUT_MILLISECONDS),
        body,
      });

      if (!response.ok) {
        await response.body?.cancel();

        throw new HistoryImportFailed({
          reason: `The historical import was rejected with HTTP ${response.status}; rerun the same reviewed import after resolving the fence`,
        });
      }

      const receipt = await readReceipt({ response });

      if (
        receipt.sourceDigest !== scope.summary.sourceDigest ||
        receipt.sourceSequence !== file.sourceSequence ||
        receipt.isFinal !== file.isFinal
      ) {
        throw new HistoryImportFailed({ reason: 'The historical import acknowledgment identifies a different batch' });
      }
    }
  }

  for (const scope of scopes) {
    await applyScope({ scope });
  }

  return evidence.sha256;
}
