/** The status the process ends with, a member of the program's own exit statuses. */
type FinishInput = { readonly status: number };

/** Ends the process with `status` once its output is written. */
export function finish({ status }: FinishInput): void {
  process.exitCode = status;
}
