import type { InboxItemId } from './entity.schemas.ts';

type CreateSlackIntakeNoticeKeyInput = { readonly inboxItemId: InboxItemId };

/** Intake acknowledgements and refusals share a retry identity separate from the agent's final reply. */
export function createSlackIntakeNoticeKey({ inboxItemId }: CreateSlackIntakeNoticeKeyInput): string {
  return `intake:${inboxItemId}`;
}
