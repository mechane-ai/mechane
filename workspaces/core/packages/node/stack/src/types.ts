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

export type ModelPlan = {
  readonly marker: string;
  readonly replies: ReadonlyArray<ModelReply>;
  readonly summary?: string;
};

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

export type GitHubFixture = {
  readonly origin: URL;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly users: { readonly owner: GitHubUser; readonly member: GitHubUser; readonly outsider: GitHubUser };
};

export type NotificationProducerFixture = { readonly id: string; readonly signingSecret: string };

export type LocalFixtures = {
  readonly github: GitHubFixture;
  readonly model: ModelFixture;
  readonly notifications: NotificationProducerFixture;
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

export type ConversationImportScope = { readonly workspaceId: string; readonly mechId: string };

type ImportedPublication = {
  readonly id: string;
  readonly text: string;
  readonly presentation: Readonly<Record<string, unknown>> | null;
  readonly createdAt: string;
  readonly shouldRepairId: boolean;
};

export type ConversationImport = { readonly runId: string; readonly publications: ReadonlyArray<ImportedPublication> };

type PreparedConversationImport = ConversationImport & { readonly applyMigration: () => Promise<void> };

export type LocalStack = {
  readonly origin: URL;
  readonly databaseUrl: string;
  readonly stateDirectory: string;
  readonly fixtures: LocalFixtures | undefined;
  readonly sandbox:
    | { readonly origin: URL; readonly bearer: string; readonly loseMachine: (id: string) => Promise<void> }
    | undefined;
  readonly serverLog: string;
  readonly postgresContainer: string;
  readonly nodeVersion: string;
  readonly dumpStorage: () => Promise<string>;
  readonly restart: (input?: RestartOptions) => Promise<void>;
  readonly prepareConversationImport: (input: ConversationImportScope) => Promise<PreparedConversationImport>;
  readonly stop: () => Promise<void>;
};

export type ManagedProcess = {
  readonly child: ChildProcess;
  readonly exited: Promise<number | null>;
  readonly stop: (signal?: 'SIGTERM' | 'SIGKILL') => Promise<void>;
};
