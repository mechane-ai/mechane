import { writeResult } from '@mechane/program';

/** The lines a command prints as its result. */
type WriteLinesInput = { readonly lines: ReadonlyArray<string> };

/** Writes a command's result, such as the fingerprint or the changed set, to standard output, one line each. */
export function writeLines({ lines }: WriteLinesInput): void {
  for (const line of lines) {
    writeResult({ line });
  }
}
