/**
 * An execution to run once in the sandbox under the id its tool call derives, waiting at most `waitMs` for it to
 * settle. While it answers Running, its caller asks again with the same input.
 */
export type RunExecutionInput = {
  readonly executionId: string;
  readonly command: string;
  readonly timeoutMs: number;
  readonly waitMs: number;
};
