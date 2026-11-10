export type StackCleanupOptions = { readonly deadlineMs?: number };

export class StackStartupFailedError extends Error {
  readonly stateDirectory: string;
  readonly stop: (() => Promise<void>) | undefined;

  constructor(stateDirectory: string, cause: unknown, stop?: () => Promise<void>) {
    super(`The local stack could not start; inspect its retained files at ${stateDirectory}`, { cause });

    this.name = 'StackStartupFailedError';
    this.stateDirectory = stateDirectory;
    this.stop = stop;
  }
}

export class StackCleanupUnconfirmedError extends Error {
  readonly stateDirectory: string;
  readonly stop: (options?: StackCleanupOptions) => Promise<void>;

  constructor(stateDirectory: string, cause: unknown, stop: (options?: StackCleanupOptions) => Promise<void>) {
    super(`The local cleanup is unconfirmed; retained ownership is recorded at ${stateDirectory}`, { cause });

    this.name = 'StackCleanupUnconfirmedError';
    this.stateDirectory = stateDirectory;
    this.stop = stop;
  }
}
