import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { ROOT_CONVERSATION_ID } from '@earendil-works/pi-durable';
import { Option } from 'effect';
import type { HarnessHandle, InboxItemQuery } from '../types.ts';
import { stopRun } from './stop-run.ts';

type CancelInboxItemInput = HarnessHandle & InboxItemQuery;

const SubmissionAbortResult = { AlreadyPlaced: 'already_placed' } as const;

/** Aborting a submission leaves every unrelated input and run intact. */
export async function cancelInboxItem({ harness, inboxItemId }: CancelInboxItemInput): Promise<void> {
  const record = await harness.commit(
    async (transaction) => await transaction.submissionByRequest(ROOT_CONVERSATION_ID, inboxItemId),
    BACKGROUND_CONTEXT,
  );

  const submission = Option.fromNullishOr(record);

  if (Option.isNone(submission)) {
    return;
  }

  const { id } = submission.value;
  const result = await harness.abortSubmission(id, BACKGROUND_CONTEXT, ROOT_CONVERSATION_ID);

  if (result === SubmissionAbortResult.AlreadyPlaced) {
    await stopRun({ harness, submissionIds: [id] });
  }
}
