/** A diagnostic line, and the name of the program that writes it. */
type WriteDiagnosticInput = { readonly program: string; readonly line: string };

/** Writes a progress line or an error of a program to standard error, prefixed with the program's name. */
export function writeDiagnostic({ program, line }: WriteDiagnosticInput): void {
  console.error(`${program}: ${line}`);
}
