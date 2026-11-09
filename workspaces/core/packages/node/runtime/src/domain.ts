import type { ModelMessage, UIMessage } from 'ai';

export const MAXIMUM_WORKING_CONTEXT_BYTES = 196_608;

export type Identity = { readonly provider: 'github'; readonly subject: string; readonly login: string };

export type MechDefinition = {
  readonly name: string;
  readonly model: string;
  readonly instructions: string | null;
  readonly dailyCapMicros: number;
  readonly status: 'active' | 'paused' | 'archived';
};

export type Mech = MechDefinition & {
  readonly id: string;
  readonly workspaceId: string;
  readonly creatorId: string;
  readonly revision: number;
  readonly updaterId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly forkedFrom: { readonly mechId: string; readonly sequence: number } | null;
};

export type MechRevision = MechDefinition & {
  readonly mechId: string;
  readonly revision: number;
  readonly updaterId: string;
  readonly updatedAt: string;
};

export type SlackOrigin = {
  readonly kind: 'slack';
  readonly teamId: string;
  readonly channelId: string;
  readonly threadId: string;
  readonly messageId: string;
  readonly userId: string;
  readonly bindingId: string;
  readonly installationId: string;
};

export type ConsoleOrigin = { readonly kind: 'console' | 'api'; readonly principalId: string };
export type NotificationOrigin = { readonly kind: 'notification'; readonly notificationId: string | null };
export type InputOrigin = SlackOrigin | ConsoleOrigin | NotificationOrigin;

export type InputAttachment = {
  readonly id: string;
  readonly name: string;
  readonly mediaType: string | null;
  readonly sizeBytes: number | null;
  readonly url: string | null;
};

export type RunStatus = 'queued' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';
export type RunFailureReason = 'allowance_exhausted' | 'faulted';

export type Run = {
  readonly id: string;
  readonly workspaceId: string;
  readonly mechId: string;
  readonly sessionId: string;
  readonly inputId: string;
  /** Association includes scheduled notices; the context cursor and trace record actual presentation. */
  readonly notificationIds: ReadonlyArray<string>;
  readonly workflowId: string | null;
  readonly definitionRevision: number;
  readonly status: RunStatus;
  readonly version: number;
  readonly inputText: string;
  readonly inputMessage: UIMessage;
  readonly attachments: ReadonlyArray<InputAttachment>;
  readonly origin: InputOrigin;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly error: string | null;
  readonly failureReason: RunFailureReason | null;
  readonly reply: string | null;
  readonly cancelRequestedAt: string | null;
};

export type NotificationSource = { readonly name: string; readonly eventId: string; readonly url?: string };

export type NotificationProducer =
  | { readonly kind: 'member'; readonly principalId: string }
  | { readonly kind: 'producer'; readonly id: string };

export type Notification = {
  readonly id: string;
  readonly workspaceId: string;
  readonly mechId: string;
  readonly receivedSequence: number;
  readonly receivedAt: string;
  readonly text: string;
  readonly source: NotificationSource;
  readonly producer: NotificationProducer;
  readonly data: Readonly<Record<string, unknown>> | null;
};

export type NotificationReceipt = {
  readonly id: string;
  readonly mechId: string;
  readonly receivedAt: string;
  readonly receivedSequence: number;
  readonly wasCreated: boolean;
};

export type ConsoleMessage = {
  readonly id: string;
  readonly workspaceId: string;
  readonly mechId: string;
  readonly runId: string | null;
  readonly sequence: number;
  readonly role: 'user' | 'assistant';
  readonly text: string;
  readonly presentation: Readonly<Record<string, unknown>> | null;
  readonly createdAt: string;
};

export type StoredMessages = {
  readonly modelMessages: ReadonlyArray<ModelMessage>;
  readonly uiMessages: ReadonlyArray<UIMessage>;
};

export type ActivityEvent = {
  readonly id: string;
  readonly sequence: number;
  readonly workspaceId: string;
  readonly mechId: string;
  readonly runId: string | null;
  readonly type: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
};

export type ExecutionAccess = {
  readonly variables: Readonly<Record<string, string>>;
  readonly secrets: Readonly<Record<string, string>>;
};

export type CredentialEnvelope = { readonly keyVersion: string; readonly nonce: string; readonly ciphertext: string };

export type CredentialMetadata = {
  readonly workspaceId: string;
  readonly reference: string;
  readonly keyVersion: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CredentialKeyring = { readonly current: string; readonly keys: Readonly<Record<string, string>> };

export type ModelUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
};

export type SpendReservation = {
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

export type Allowance = {
  readonly workspaceId: string;
  readonly mechId: string | null;
  readonly date: string;
  readonly capMicros: number;
  readonly spentMicros: number;
  readonly reservedMicros: number;
};

export type ExecutionReceipt = {
  readonly id: string;
  readonly runId: string;
  readonly kind: 'sandbox' | 'mcp' | 'process' | 'browser';
  /** Null for shell and MCP receipts; interactive requests retain their immutable, secret-free payload. */
  readonly request: Readonly<Record<string, unknown>> | null;
  readonly status: 'pending' | 'running' | 'completed' | 'uncertain' | 'failed';
  readonly providerId: string | null;
  readonly result: Readonly<Record<string, unknown>> | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};
