/** The codes of the diagnostics the bash tool reports, beside pi's own. */
export const BashDiagnostic = {
  ExitCode: 'exit_code',
  Timeout: 'timeout',
  Uncertain: 'uncertain',
  Unavailable: 'sandbox_unavailable',
  PersistenceFailed: 'workspace_not_saved',
  Invalid: 'command_invalid',
  Dropped: 'output_dropped',
} as const;
