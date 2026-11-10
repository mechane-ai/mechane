type AutomaticAccessNoticeKeyInput = { readonly taskId: number };

/** Replayed tool executions share one durable automatic-grant notice. */
export function automaticAccessNoticeKey({ taskId }: AutomaticAccessNoticeKeyInput): string {
  return `request:${taskId}:automatic`;
}
