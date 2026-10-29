import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { ROOT_CONVERSATION_ID } from '@earendil-works/pi-durable';
import type { ConversationId, Harness, Tx } from '@earendil-works/pi-durable';
import { Option } from 'effect';
import { droneConversationId } from '../drones/drone-conversation-id.ts';
import type { ProgressQuery } from '../types.ts';
import { progressReport } from './progress-report.ts';
import type { ItemProgressReport, ReadSubmission } from './types.ts';

/** The inbox items and the drones whose progress to read, and the opened Harness it is read from. */
type ReadProgressInput = ProgressQuery & { readonly harness: Harness };

/** A submission to read by its conversation and request id: an inbox item's in the root, a brief in its drone's. */
type ReadSubmissionInput = {
  readonly transaction: Tx;
  readonly conversationId: ConversationId;
  readonly requestId: string;
};

/** A drone's brief, by the drone's id, and the conversation it runs in. */
type BriefSource = {
  readonly droneId: string;
  /** The conversation the drone's document records, none before the drone's opening. */
  readonly conversationId: Option.Option<ConversationId>;
};

/**
 * Reads what pi holds of each inbox item and of each drone's brief, in the conversation the drone's document names,
 * with each answered input's answer entry. The read is a commit that writes nothing, so it stores nothing; an item pi
 * never admitted is missing, and a drone without its brief in pi unbriefed.
 */
export async function readProgress({
  harness,
  inboxItemIds,
  droneIds,
}: ReadProgressInput): Promise<ItemProgressReport> {
  const briefSource: (droneId: string) => Promise<BriefSource> = async (droneId) => ({
    droneId,
    conversationId: await droneConversationId({ harness, droneId }),
  });

  const sources = await Promise.all(droneIds.map(briefSource));

  const readReport: (transaction: Tx) => Promise<ItemProgressReport> = async (transaction) => {
    const readBrief: (source: BriefSource) => Promise<ReadSubmission> = async ({ droneId, conversationId }) => {
      if (Option.isNone(conversationId)) {
        return { requestId: droneId, record: Option.none(), answers: [] };
      }

      return await readSubmission({ transaction, conversationId: conversationId.value, requestId: droneId });
    };

    const items = await Promise.all(
      inboxItemIds.map((requestId) => readSubmission({ transaction, conversationId: ROOT_CONVERSATION_ID, requestId })),
    );

    const briefs = await Promise.all(sources.map(readBrief));

    return progressReport({ items, briefs });
  };

  return await harness.commit(readReport, BACKGROUND_CONTEXT);
}

/** What pi holds of one request: its submission, if pi admitted it, and the answer entry the submission names. */
async function readSubmission({
  transaction,
  conversationId,
  requestId,
}: ReadSubmissionInput): Promise<ReadSubmission> {
  const record = Option.fromNullishOr(await transaction.submissionByRequest(conversationId, requestId));
  const answerId = Option.flatMapNullishOr(record, (found) => found.answer);

  if (Option.isNone(answerId)) {
    return { requestId, record, answers: [] };
  }

  const answer = await transaction.entry(answerId.value);

  return { requestId, record, answers: Option.toArray(Option.fromNullishOr(answer)) };
}
