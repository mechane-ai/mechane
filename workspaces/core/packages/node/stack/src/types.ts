import type { ChildProcess } from 'node:child_process';

export type Environment = Readonly<Record<string, string>>;

export type ModelToolCall = {
  readonly id: string;
  readonly name: string;
  readonly input: Readonly<Record<string, unknown>>;
};

export type ModelReply = {
  readonly text?: string;
  readonly tools?: ReadonlyArray<ModelToolCall>;
  readonly isHeld?: boolean;
  readonly status?: number;
  readonly promptTokens?: number;
  readonly completionTokens?: number;
};

export type ModelPlan = { readonly marker: string; readonly replies: ReadonlyArray<ModelReply> };

export type ModelCall = {
  readonly marker: string;
  readonly index: number;
  readonly body: Readonly<Record<string, unknown>>;
  readonly authorization: string | undefined;
};

export type ModelCallSelector = { readonly marker: string; readonly index: number; readonly timeoutMs?: number };

export type ModelFixture = {
  readonly origin: URL;
  readonly apiKey: string;
  readonly configure: (plan: ModelPlan) => void;
  readonly readCalls: (input?: { readonly marker?: string }) => ReadonlyArray<ModelCall>;
  readonly waitForCall: (input: ModelCallSelector) => Promise<ModelCall>;
  readonly release: (input: ModelCallSelector) => void;
};

export type GitHubUser = { readonly id: number; readonly login: string };

export type GitHubInstallationToken = {
  readonly value: string;
  readonly repositoryIds: ReadonlyArray<number>;
  readonly permissions: Readonly<Record<string, string>>;
  readonly issuedAt: number;
  readonly revokedAt: number | null;
};

export type GitHubFixture = {
  readonly origin: URL;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly users: { readonly owner: GitHubUser; readonly member: GitHubUser; readonly outsider: GitHubUser };
  readonly app: {
    readonly id: number;
    readonly installationId: number;
    readonly repositoryId: number;
    readonly privateKey: string;
    readonly readTokens: () => ReadonlyArray<GitHubInstallationToken>;
  };
};

export type SlackCall = { readonly method: string; readonly body: Readonly<Record<string, unknown>> };

export type SlackMessage = {
  readonly ts: string;
  readonly channel: string;
  readonly thread_ts: string;
  readonly text: string;
  readonly markdown_text?: string | undefined;
  readonly user: string;
  readonly bot_id: string;
  readonly blocks?: unknown;
  readonly metadata?: unknown;
  readonly client_msg_id?: string | undefined;
};

export type SlackFixture = {
  readonly origin: URL;
  readonly botToken: string;
  readonly signingSecret: string;
  readonly teamId: string;
  readonly botUserId: string;
  readonly readCalls: () => ReadonlyArray<SlackCall>;
  readonly readMessages: () => ReadonlyArray<SlackMessage>;
  readonly loseNextPostReceipt: () => void;
};

export type NexusRequestStatus = 'pending' | 'ready' | 'denied' | 'expired' | 'cancelled';

export type NexusRequest = {
  readonly id: string;
  readonly kind: 'access' | 'vend';
  readonly status: NexusRequestStatus;
  readonly approval: { readonly id: string; readonly url: string; readonly status: string } | null;
  readonly error: string | null;
  readonly body: Readonly<Record<string, unknown>>;
};

export type NexusFixture = {
  readonly origin: URL;
  readonly apiKey: string;
  readonly serviceId: string;
  readonly signingSecret: string;
  readonly readRequests: () => ReadonlyArray<NexusRequest>;
  readonly resolve: (input: { readonly id: string; readonly status: NexusRequestStatus }) => NexusRequest;
  readonly waitForRequest: (input?: { readonly timeoutMs?: number }) => Promise<NexusRequest>;
};

export type LocalFixtures = {
  readonly github: GitHubFixture;
  readonly model: ModelFixture;
  readonly slack: SlackFixture;
  readonly nexus: NexusFixture;
  readonly close: () => Promise<void>;
};

export type StackOptions = {
  readonly mode: 'ephemeral' | 'persistent';
  readonly stateDirectory?: string;
  readonly serverEntry?: string;
  readonly nodeExecutable?: string;
  readonly sandbox?: 'host-fixture' | 'configured';
  readonly origin?: URL;
  readonly environment?: Environment;
  readonly useFixtures?: boolean;
};

export type RestartOptions = { readonly signal?: 'SIGTERM' | 'SIGKILL'; readonly environment?: Environment };

export type LocalStack = {
  readonly origin: URL;
  readonly databaseUrl: string;
  readonly stateDirectory: string;
  readonly fixtures: LocalFixtures | undefined;
  readonly serverLog: string;
  readonly postgresContainer: string;
  readonly nodeVersion: string;
  readonly dumpStorage: () => Promise<string>;
  readonly restart: (input?: RestartOptions) => Promise<void>;
  readonly stop: () => Promise<void>;
};

export type ManagedProcess = {
  readonly child: ChildProcess;
  readonly exited: Promise<number | null>;
  readonly stop: (signal?: 'SIGTERM' | 'SIGKILL') => Promise<void>;
};
