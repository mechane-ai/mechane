import type { CelldBinary, Environment, LocalSourceUpdate, LocalWorkerStatus } from '../types.ts';

export type CelldWorkerOptions = {
  readonly entry: string;
  readonly configuration: Readonly<Record<string, unknown>>;
  readonly directory: string;
  readonly origin: URL;
  readonly environment: Environment;
  readonly celldBinary?: CelldBinary;
  readonly isArtifact?: boolean;
  readonly isWatched?: boolean;
  readonly readiness?: CelldReadiness;
};

export type CelldReadiness = {
  readonly path: string;
  readonly status: number;
  readonly timeoutMs?: number;
  readonly headers?: Readonly<Record<string, string>>;
};

export type CelldCloseOptions = { readonly deadlineMs?: number; readonly signal?: 'SIGTERM' | 'SIGKILL' };

export type LocalCelldWorker = {
  readonly origin: URL;
  readonly directory: string;
  readonly logFile: string;
  readonly buildLogFile: string;
  readonly version: string;
  readonly pid: number;
  readonly restart: (signal?: 'SIGTERM' | 'SIGKILL', whileStopped?: () => Promise<void>) => Promise<void>;
  readonly applySource: (input?: LocalSourceUpdate) => Promise<void>;
  readonly inspect: () => Promise<LocalWorkerStatus>;
  readonly close: (options?: CelldCloseOptions) => Promise<void>;
};
