type WriteResultInput = { readonly line: string };

/** Writes a line of a program's result, such as an export to copy, to standard output. */
export function writeResult({ line }: WriteResultInput): void {
  console.log(line);
}
