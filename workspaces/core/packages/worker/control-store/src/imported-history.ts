import type { ModelUsage } from './domain.ts';

export type ImportedJson = Readonly<Record<string, unknown>>;

export type ImportedAttachment = {
  readonly id: string;
  readonly name: string;
  readonly mediaType: string | null;
  readonly sizeBytes: number | null;
  readonly url: string | null;
};

export type ImportedRun = {
  readonly id: string;
  readonly workspaceId: string;
  readonly mechId: string;
  readonly sessionId: string;
  readonly inputId: string;
  readonly notificationIds: ReadonlyArray<string>;
  readonly workflowId: string | null;
  readonly definitionRevision: number;
  readonly status: 'queued' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';
  readonly version: number;
  readonly inputText: string;
  readonly inputMessage: ImportedJson;
  readonly attachments: ReadonlyArray<ImportedAttachment>;
  readonly origin: ImportedJson;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly error: string | null;
  readonly failureReason: 'allowance_exhausted' | 'faulted' | null;
  readonly reply: string | null;
  readonly cancelRequestedAt: string | null;
};

export type ImportedActivity = {
  readonly id: string;
  readonly sequence: number;
  readonly workspaceId: string;
  readonly mechId: string;
  readonly runId: string | null;
  readonly type: string;
  readonly payload: ImportedJson;
  readonly createdAt: string;
};

export type ImportedSpendReservation = {
  readonly id: string;
  readonly runId: string;
  readonly workspaceId: string;
  readonly mechId: string;
  readonly model: string;
  readonly reservedMicros: number;
  readonly settledMicros: number | null;
  readonly usage: ModelUsage | null;
  readonly state: 'reserved' | 'settled' | 'refused';
  readonly createdAt: string;
  readonly settledAt: string | null;
};

export type ImportedConsoleMessage = {
  readonly id: string;
  readonly workspaceId: string;
  readonly mechId: string;
  readonly runId: string | null;
  readonly sequence: number;
  readonly role: 'user' | 'assistant';
  readonly text: string;
  readonly presentation: ImportedJson | null;
  readonly createdAt: string;
};

export type ImportedNotification = {
  readonly id: string;
  readonly workspaceId: string;
  readonly mechId: string;
  readonly receivedSequence: number;
  readonly receivedAt: string;
  readonly text: string;
  readonly source: ImportedJson;
  readonly producer: ImportedJson;
  readonly data: ImportedJson | null;
};

export type ImportedMechContext = {
  readonly receivedSequence: number;
  readonly presentedSequence: number;
  readonly activeRunId: string | null;
  readonly isWakePending: boolean;
  readonly isEnvironmentCheckpointRequired: boolean;
  readonly modelMessages: ReadonlyArray<ImportedJson>;
  readonly notesImportedAt: string | null;
  readonly isContextInitialized: boolean;
  readonly updatedAt: string;
};

export type ImportScope = {
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly mechId: string;
  readonly mechName: string;
  readonly status: 'active' | 'paused' | 'archived';
  readonly definitionRevision: number;
  readonly isWorkspaceSuspended: boolean;
};

export type ImportScopeSelection = { readonly workspaceId?: string; readonly mechId?: string };

export type ImportedOwner = {
  readonly id: string;
  readonly status: 'queued' | 'running' | 'waiting';
  readonly workflowId: string | null;
};

export type ImportFence = {
  readonly scope: ImportScope;
  readonly snapshotAt: string;
  readonly activeRuns: ReadonlyArray<ImportedOwner>;
  readonly context: ImportedMechContext | null;
  readonly runCount: number;
  readonly activityCount: number;
  readonly notificationCount: number;
  readonly consoleMessageCount: number;
  readonly executionReceiptCount: number;
  readonly pendingExecutionReceiptCount: number;
};

export type ImportedExecutionReceipt = {
  readonly id: string;
  readonly runId: string;
  readonly kind: 'sandbox' | 'mcp' | 'process' | 'browser';
  readonly status: 'pending' | 'running' | 'completed' | 'uncertain' | 'failed';
  readonly request: ImportedJson | null;
  readonly providerId: string | null;
  readonly result: ImportedJson | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};
