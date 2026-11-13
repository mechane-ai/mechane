import type { Buffer } from 'node:buffer';
import type { ChildProcess } from 'node:child_process';
import type { HttpHandler } from './fixtures/http.ts';

export type Environment = Readonly<Record<string, string>>;

export type LocalProvider = 'fixture' | 'live';

export type LocalProviders = { readonly model: LocalProvider; readonly github: LocalProvider };

export type LocalCli = { readonly command: string; readonly args: ReadonlyArray<string> };

export type LocalSourceUpdate = { readonly configuration?: Readonly<Record<string, unknown>> };

export type LocalWorkerStatus = {
  readonly pid: number | undefined;
  readonly isSource: boolean;
  readonly compiledSha256: string | undefined;
  readonly appliedSha256: string | undefined;
  readonly lastBuildDurationMs: number | undefined;
};

export type LocalStackStatus = {
  readonly origin: string;
  readonly stateDirectory: string;
  readonly providers: LocalProviders;
  readonly cli: LocalCli;
  readonly application: LocalWorkerStatus | undefined;
  readonly sandbox: LocalWorkerStatus | undefined;
  readonly guestImage: string;
  readonly isAdmissionHeld: boolean;
};

export type LocalToolAsset = {
  readonly name: string;
  readonly version: string;
  readonly versionOutput: string;
  readonly target: 'linux-arm64' | 'linux-x64';
  readonly archivePath: string;
  readonly sha256: string;
  readonly executable: string;
};

export type LocalGuestSetup = {
  readonly registerFixture: (answer: HttpHandler) => GuestHttpFixture;
  readonly registerFixturePrefix: (answer: HttpHandler) => GuestHttpFixture;
};

export type CelldBinary = { readonly executable: string; readonly version: string; readonly sha256: string };

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
  readonly streamResponseId?: string;
  readonly streamError?: {
    readonly code: number;
    readonly type: string;
    readonly param: string;
    readonly message: string;
    readonly metadata: Readonly<Record<string, unknown>>;
  };
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
  readonly purpose: 'generation' | 'compaction';
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
  readonly github: GitHubFixture | undefined;
  readonly model: ModelFixture | undefined;
  readonly notifications: NotificationProducerFixture;
  readonly close: () => Promise<void>;
};

export type StackOptions = {
  readonly mode: 'ephemeral' | 'persistent';
  readonly stateDirectory?: string;
  readonly serverEntry?: string;
  readonly isSource?: boolean;
  readonly isConsoleDevelopment?: boolean;
  readonly assetsDirectory?: string;
  readonly sandboxImage?: string;
  readonly celldBinary?: CelldBinary;
  readonly nodeExecutable?: string;
  readonly sandbox?: 'container' | 'configured';
  readonly origin?: URL;
  readonly environment?: Environment;
  readonly providers?: LocalProviders;
  readonly cli?: LocalCli;
  readonly toolAssets?: ReadonlyArray<LocalToolAsset>;
  readonly prepareGuest?: (input: LocalGuestSetup) => Promise<ReadonlyArray<LocalToolAsset>>;
};

export type RestartOptions = { readonly signal?: 'SIGTERM' | 'SIGKILL'; readonly environment?: Environment };
export type SandboxRestartOptions = Pick<RestartOptions, 'signal'> & { readonly whileStopped?: () => Promise<void> };

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

export type SandboxFixtureMachine = { readonly machineId: string; readonly containerId: string };
export type SandboxFixtureFile = { readonly machineId: string; readonly path: string };
export type SandboxFixtureWrite = SandboxFixtureFile & { readonly contents: string };
export type DiagnosticOptions = { readonly signal?: AbortSignal };
export type GuestHttpFixture = { readonly url: URL; readonly close: () => Promise<void> };

export type LocalSandbox = {
  readonly origin: URL;
  readonly bearer: string;
  readonly pid?: number;
  readonly logFile?: string;
  readonly readMachines: () => Promise<ReadonlyArray<string>>;
  readonly inspectMachine: (machineId: string) => Promise<SandboxFixtureMachine | undefined>;
  readonly dumpStatus: (options?: DiagnosticOptions) => Promise<string>;
  readonly persistedFiles: (options?: DiagnosticOptions) => AsyncIterable<Buffer>;
  readonly readFile: (input: SandboxFixtureFile) => Promise<string | undefined>;
  readonly writeFile: (input: SandboxFixtureWrite) => Promise<void>;
  readonly restart: (input?: SandboxRestartOptions) => Promise<void>;
  readonly applySource: (input?: LocalSourceUpdate) => Promise<void>;
  readonly inspect: () => Promise<LocalWorkerStatus>;
  readonly loseMachine: (id: string) => Promise<void>;
  readonly close: (deadlineMs?: number) => Promise<void>;
};

export type LocalStack = {
  readonly origin: URL;
  readonly databaseUrl: string;
  readonly stateDirectory: string;
  readonly fixtures: LocalFixtures | undefined;
  readonly sandbox: LocalSandbox | undefined;
  readonly serverLog: string;
  readonly postgresContainer: string;
  readonly nodeVersion: string;
  readonly cli: LocalCli;
  readonly providers: LocalProviders;
  readonly inspect: () => Promise<LocalStackStatus>;
  readonly applySandbox: () => Promise<void>;
  readonly applyGuest: () => Promise<void>;
  readonly dumpStorage: (options?: DiagnosticOptions) => Promise<string>;
  readonly captureFailure: (label: string) => Promise<string>;
  readonly registerGuestFixture: (answer: HttpHandler) => GuestHttpFixture;
  readonly registerGuestFixturePrefix: (answer: HttpHandler) => GuestHttpFixture;
  readonly restart: (input?: RestartOptions) => Promise<void>;
  readonly prepareConversationImport: (input: ConversationImportScope) => Promise<PreparedConversationImport>;
  readonly stop: () => Promise<void>;
};

export type ManagedProcess = {
  readonly child: ChildProcess;
  readonly exited: Promise<number | null>;
  readonly readChildGroups: () => Promise<ReadonlyArray<ManagedProcessIdentity>>;
  readonly stop: (signal?: 'SIGTERM' | 'SIGKILL', timeoutMs?: number) => Promise<void>;
};

export type ManagedProcessIdentity = {
  readonly pid: number;
  readonly parentPid: number;
  readonly group: number;
  readonly started: string;
};
