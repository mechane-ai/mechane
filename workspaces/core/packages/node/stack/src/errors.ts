export class StackStartupFailedError extends Error {
  readonly stateDirectory: string;

  constructor(stateDirectory: string, cause: unknown) {
    super(`The local stack could not start; inspect its retained files at ${stateDirectory}`, { cause });

    this.name = 'StackStartupFailedError';
    this.stateDirectory = stateDirectory;
  }
}
