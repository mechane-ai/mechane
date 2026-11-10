export class ToolUnavailableError extends Error {
  constructor(message: string) {
    super(message);

    this.name = 'ToolUnavailableError';
  }
}

export class ToolNotStartedError extends Error {
  constructor(message: string) {
    super(message);

    this.name = 'ToolNotStartedError';
  }
}
