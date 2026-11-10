import { openImportedHistory } from '@mechane/control-store';
import type { ImportedHistory, ImportScope, ImportScopeSelection } from '@mechane/control-store';
import { MechHistorySourceKind } from '@mechane/protocol';
import { createHash } from 'node:crypto';
import { createBatchWriter } from './batches.ts';
import type { ImportBatchFile } from './batches.ts';
import { HistoryImportFailed } from './errors.ts';
import { historyPages } from './pages.ts';

const HISTORY_PAGE_MAX_ROWS = 200;

type HistoryCounts = {
  readonly runs: number;
  readonly activities: number;
  readonly consoleMessages: number;
  readonly notifications: number;
  readonly pendingNotifications: number;
  readonly executionReceipts: number;
  readonly memories: number;
  readonly workItems: number;
};

export type ImportScopeSummary = {
  readonly workspaceId: string;
  readonly mechId: string;
  readonly sourceDigest: string;
  readonly batches: number;
  readonly sourceBytes: number;
  readonly counts: HistoryCounts;
};

export type PreparedScope = { readonly summary: ImportScopeSummary; readonly files: ReadonlyArray<ImportBatchFile> };
export type PreparedImport = { readonly digest: string; readonly scopes: ReadonlyArray<PreparedScope> };
type ExportScopeInput = { readonly history: ImportedHistory; readonly scope: ImportScope; readonly directory: string };

type ExportHistoryInput = {
  readonly databaseUrl: string;
  readonly selection: ImportScopeSelection;
  readonly directory: string;
};

async function exportScope({ history, scope, directory }: ExportScopeInput): Promise<PreparedScope> {
  const { workspaceId, mechId } = scope;
  const fence = await history.getExportFence({ workspaceId, mechId });

  if (!fence.scope.isWorkspaceSuspended) {
    throw new HistoryImportFailed({ reason: `Suspend workspace ${workspaceId} before exporting preserved history` });
  }

  const batchWriter = createBatchWriter({ workspaceId, mechId, directory, context: fence.context });

  const counts = {
    runs: 0,
    activities: 0,
    consoleMessages: 0,
    notifications: 0,
    pendingNotifications: 0,
    executionReceipts: 0,
    memories: 0,
    workItems: 0,
  };

  const pageScope = { workspaceId, mechId, maxRows: HISTORY_PAGE_MAX_ROWS };
  const presentedSequence = fence.context?.presentedSequence ?? 0;

  await batchWriter.append({
    kind: MechHistorySourceKind.Manifest,
    record: {
      scope: fence.scope,
      activeRuns: fence.activeRuns,
      pendingExecutionReceiptCount: fence.pendingExecutionReceiptCount,
    },
  });

  for await (const run of historyPages({
    initialCursor: null,
    read: (after: string | null) => history.listRuns({ ...pageScope, after }),
    cursorOf: (row) => row.id,
  })) {
    const trace = await history.getRunTrace({ workspaceId, mechId, runId: run.id });
    const cancellation = await history.getRunCancellation({ workspaceId, mechId, runId: run.id });

    await batchWriter.append({ kind: MechHistorySourceKind.Run, record: { ...trace, cancellation } });

    counts.runs += 1;
  }

  for await (const event of historyPages({
    initialCursor: 0,
    read: (after: number) => history.listActivities({ ...pageScope, after }),
    cursorOf: (row) => row.sequence,
  })) {
    await batchWriter.append({ kind: MechHistorySourceKind.Activity, record: event });

    counts.activities += 1;
  }

  for await (const message of historyPages({
    initialCursor: 0,
    read: (afterSequence: number) => history.listConsoleMessages({ ...pageScope, afterSequence }),
    cursorOf: (row) => row.sequence,
  })) {
    await batchWriter.append({ kind: MechHistorySourceKind.Publication, record: message });

    counts.consoleMessages += 1;
  }

  for await (const notification of historyPages({
    initialCursor: 0,
    read: (afterSequence: number) => history.listNotifications({ ...pageScope, afterSequence }),
    cursorOf: (row) => row.receivedSequence,
  })) {
    await batchWriter.append({ kind: MechHistorySourceKind.Notification, record: notification, notification });

    counts.notifications += 1;

    if (notification.receivedSequence > presentedSequence) {
      counts.pendingNotifications += 1;
    }
  }

  for await (const receipt of historyPages({
    initialCursor: null,
    read: (afterId: string | null) => history.listExecutionReceipts({ ...pageScope, afterId }),
    cursorOf: (row) => row.id,
  })) {
    await batchWriter.append({ kind: MechHistorySourceKind.Execution, record: receipt, execution: receipt });

    counts.executionReceipts += 1;
  }

  for await (const memory of historyPages({
    initialCursor: null,
    read: (afterPath: string | null) => history.listMemories({ ...pageScope, afterPath }),
    cursorOf: (row) => row.path,
  })) {
    await batchWriter.append({ kind: MechHistorySourceKind.Memory, record: memory });

    counts.memories += 1;
  }

  for await (const work of historyPages({
    initialCursor: null,
    read: (afterId: string | null) => history.listWorkItems({ ...pageScope, afterId }),
    cursorOf: (row) => row.id,
  })) {
    await batchWriter.append({ kind: MechHistorySourceKind.WorkItem, record: work });

    counts.workItems += 1;
  }

  const hasMatchingConversationCounts =
    counts.runs === fence.runCount &&
    counts.activities === fence.activityCount &&
    counts.consoleMessages === fence.consoleMessageCount;

  const hasMatchingDeliveryCounts =
    counts.notifications === fence.notificationCount && counts.executionReceipts === fence.executionReceiptCount;

  if (!hasMatchingConversationCounts || !hasMatchingDeliveryCounts) {
    throw new HistoryImportFailed({ reason: `Preserved-history counts do not match the snapshot for mech ${mechId}` });
  }

  const prepared = await batchWriter.finish();

  return {
    summary: {
      workspaceId,
      mechId,
      sourceDigest: prepared.sourceDigest,
      batches: prepared.files.length,
      sourceBytes: prepared.sourceBytes,
      counts,
    },
    files: prepared.files,
  };
}

export async function exportHistory({
  databaseUrl,
  selection,
  directory,
}: ExportHistoryInput): Promise<PreparedImport> {
  const history = await openImportedHistory({ databaseUrl });

  try {
    const selected = await history.listImportScopes(selection);

    if (selected.length === 0) {
      throw new HistoryImportFailed({ reason: 'The selected source contains no mechs' });
    }

    const scopes: Array<PreparedScope> = [];

    for (const scope of selected) {
      scopes.push(await exportScope({ history, scope, directory }));
    }

    const digest = createHash('sha256')
      .update(JSON.stringify(scopes.map(({ summary }) => summary)))
      .digest('hex');

    return { digest, scopes };
  } finally {
    await history.close();
  }
}
