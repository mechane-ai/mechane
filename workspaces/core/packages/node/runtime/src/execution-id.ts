type ExecutionIdentity = { readonly runId: string; readonly toolCallId: string };
const UUID_HEX_LENGTH = 32;
const UUID_GROUPS = /^(.{8})(.{4}).(.{3}).(.{3})(.{12})$/u;

export async function executionId({ runId, toolCallId }: ExecutionIdentity): Promise<string> {
  const { createHash } = await import('node:crypto');

  const digest = createHash('sha256')
    .update(JSON.stringify(['mechane-tool', runId, toolCallId]))
    .digest('hex');

  return digest.slice(0, UUID_HEX_LENGTH).replace(UUID_GROUPS, '$1-$2-8$3-a$4-$5');
}
