import { ExitStatus } from '@mechane/commands';
import { writeResult } from '@mechane/program';

type PrintLinesInput = { readonly lines: ReadonlyArray<string> };

/** Writes lines that need no deployment, such as the help, to standard output, which completes the invocation. */
export function printLines({ lines }: PrintLinesInput): ExitStatus {
  for (const line of lines) {
    writeResult({ line });
  }

  return ExitStatus.Ok;
}
