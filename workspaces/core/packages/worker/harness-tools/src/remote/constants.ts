/** These root-only names are excluded from delegated drone tool selections. */
export const RemoteTool = { List: 'list_remote_tools', Call: 'call_remote_tool' } as const;

/** Tool failures use stable diagnostic codes without transport exception text. */
export const RemoteDiagnostic = {
  Invalid: 'remote_arguments_invalid',
  Refused: 'remote_tool_refused',
  Failed: 'remote_tool_failed',
} as const;
