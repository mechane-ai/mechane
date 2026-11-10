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

type RunFields = {
  readonly id: string;
  readonly workspaceId: string;
  readonly mechId: string;
  readonly sessionId: string;
  readonly inputId: string;
  /** Association includes scheduled notices; the context cursor and trace record actual presentation. */
  readonly notificationIds: ReadonlyArray<string>;
  readonly definitionRevision: number;
  readonly status: RunStatus;
  readonly version: number;
  readonly inputText: string;
  readonly attachments: ReadonlyArray<InputAttachment>;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly error: string | null;
  readonly failureReason: RunFailureReason | null;
  readonly reply: string | null;
  readonly cancelRequestedAt: string | null;
};

type HistoricalConsoleOrigin = { readonly kind: 'console' | 'api'; readonly principalId?: string };
type NativeRun = { readonly runtimeSource?: 'native'; readonly origin: InputOrigin };
type ImportedRun = { readonly runtimeSource: 'imported'; readonly origin: InputOrigin | HistoricalConsoleOrigin };

export type Run = RunFields & (NativeRun | ImportedRun);

export type NotificationSource = { readonly name: string; readonly eventId: string; readonly url?: string };

type MemberProducer = { readonly kind: 'member'; readonly principalId: string };
type ExternalProducer = { readonly kind: 'producer'; readonly id: string };
export type NotificationProducer = MemberProducer | ExternalProducer;

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
