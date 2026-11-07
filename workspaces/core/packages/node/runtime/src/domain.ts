import type { ModelMessage, UIMessage } from 'ai';

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
export type InputOrigin = SlackOrigin | ConsoleOrigin;

export type Session = {
  readonly id: string;
  readonly workspaceId: string;
  readonly mechId: string;
  readonly title: string;
  readonly source: 'console' | 'slack' | 'api';
  readonly createdAt: string;
  readonly updatedAt: string;
};

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

export type InputAdmission = { readonly run: Run; readonly wasCreated: boolean };

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

export type Memory = {
  readonly workspaceId: string;
  readonly mechId: string;
  readonly path: string;
  readonly text: string;
  readonly digest: string;
  readonly version: number;
  readonly runId: string | null;
  readonly updatedAt: string;
};

export type WorkItem = {
  readonly id: string;
  readonly workspaceId: string;
  readonly mechId: string;
  readonly title: string;
  readonly state: 'open' | 'resolved' | 'abandoned';
  readonly note: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type GitHubAccess = {
  readonly appId: number;
  readonly installationId: number;
  readonly repositoryId: number;
  readonly owner: string;
  readonly repository: string;
  readonly secretReference: string;
};

export type RequestService = { readonly url: string; readonly serviceId: string; readonly secretReference: string };

export type ExecutionAccess = {
  readonly github: GitHubAccess | null;
  readonly variables: Readonly<Record<string, string>>;
  readonly secrets: Readonly<Record<string, string>>;
  readonly requestService: RequestService | null;
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

export type SlackInstallation = {
  readonly id: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly botUserId: string;
  readonly botTokenReference: string;
  readonly signingSecretReference: string;
  readonly historyTokenReference: string | null;
  readonly apiOrigin: string;
  readonly updatedAt: string;
};

export type SlackBinding = {
  readonly id: string;
  readonly workspaceId: string;
  readonly installationId: string;
  readonly teamId: string;
  readonly channelId: string;
  readonly channelKind: 'channel' | 'im' | 'mpim';
  readonly mechId: string;
  readonly isListening: boolean;
  readonly isReplyEnabled: boolean;
  readonly allowedUserIds: ReadonlyArray<string> | null;
};

export type SlackDelivery = {
  readonly id: string;
  readonly workspaceId: string;
  readonly mechId: string;
  readonly runId: string | null;
  readonly bindingId: string;
  readonly channelId: string;
  readonly threadId: string;
  readonly kind: 'acknowledgement' | 'reply' | 'notification';
  readonly status: 'pending' | 'sending' | 'delivered' | 'failed' | 'uncertain' | 'blocked';
  readonly messageId: string | null;
  readonly content: Readonly<Record<string, unknown>>;
  readonly contentDigest: string;
  readonly lastError: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type RequestKind = 'access' | 'vend';
export type RequestResolution = 'ready' | 'denied' | 'expired' | 'cancelled';

export type RequestEvent = {
  readonly id: string;
  readonly type: 'nexus.request.resolved';
  readonly occurredAt: string;
  readonly serviceId: string;
  readonly request: {
    readonly id: string;
    readonly kind: RequestKind;
    readonly status: RequestResolution;
    readonly approvalId: string | null;
  };
};

export type RequestWait = {
  readonly serviceId: string;
  readonly requestId: string;
  readonly kind: RequestKind;
  readonly runId: string;
  readonly hookToken: string;
  readonly serviceIdentity: string;
  readonly resolution: RequestResolution | null;
  readonly eventId: string | null;
  readonly deliveredAt: string | null;
  readonly closedAt: string | null;
};

export type ExecutionReceipt = {
  readonly id: string;
  readonly runId: string;
  readonly kind: 'sandbox' | 'mcp';
  readonly status: 'pending' | 'running' | 'completed' | 'uncertain' | 'failed';
  readonly providerId: string | null;
  readonly result: Readonly<Record<string, unknown>> | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};
