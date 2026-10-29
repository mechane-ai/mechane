import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { ROOT_CONVERSATION_ID } from '@earendil-works/pi-durable';
import type { Harness, SubmissionRecord, Tx } from '@earendil-works/pi-durable';
import { UnansweredReason } from '@mechane/protocol';
import type { NOTED_REASONS } from '@mechane/protocol';
import { DateTime, Option } from 'effect';
import type { OwedNote } from '../types.ts';
import { stopRun } from './stop-run.ts';

/** What a turn note says first, by why its turn ended without a reply. */
const TURN_NOTE_OPENING: Readonly<Record<(typeof NOTED_REASONS)[number], string>> = {
  [UnansweredReason.Canceled]: 'Mechane canceled your previous turn before it ended.',
  [UnansweredReason.Faulted]: 'Mechane ended your previous turn because its work failed.',
};

type CloseTurnInput = { readonly harness: Harness; readonly note: OwedNote };

/** The turn whose note a request id names. */
type TurnNoteRequestIdInput = Pick<OwedNote, 'turnId'>;

/** The entry kind of a turn note in a mech's transcript; pi stores it, so it is a stored format. */
const TURN_NOTE_ENTRY_KIND = 'mechane.turn_note';

/**
 * What a turn note's request id starts with, before its turn's id; pi stores it, so it is a stored format. An inbox
 * item's request id is a random UUID, so the two never meet.
 */
const TURN_NOTE_REQUEST_PREFIX = 'turn-note:';

/** What every turn note says of the turn it follows. */
const TURN_NOTE_CONSEQUENCES = [
  'Nothing it replied reached the sender and none of its memory changes were saved. Its unfinished commands were',
  'stopped and their file changes may be lost. Drones it started still run and report back.',
].join(' ');

/**
 * Closes a canceled or faulted turn in pi: stops the run that still holds its items, then writes its note as a person's
 * message. The note's request id derives from the turn, so pi admits it once, and the message restarts the items queued
 * behind the run. Aborting the conversation instead would withdraw them.
 */
export async function closeTurn({ harness, note }: CloseTurnInput): Promise<void> {
  const readSubmissions: (transaction: Tx) => Promise<ReadonlyArray<SubmissionRecord | undefined>> = async (
    transaction,
  ) =>
    await Promise.all(
      note.inboxItemIds.map((inboxItemId) => transaction.submissionByRequest(ROOT_CONVERSATION_ID, inboxItemId)),
    );

  const records = await harness.commit(readSubmissions, BACKGROUND_CONTEXT);
  const admitted = Option.getOrThrow(Option.all(records.map(Option.fromNullishOr)));

  await stopRun({ harness, submissionIds: admitted.map((record) => record.id) });

  const conversation = Option.getOrThrow(
    Option.fromNullishOr(await harness.conversation(ROOT_CONVERSATION_ID, BACKGROUND_CONTEXT)),
  );

  const content = `${TURN_NOTE_OPENING[note.reason]} ${TURN_NOTE_CONSEQUENCES}`;

  await conversation.submit(
    {
      type: 'write',
      requestId: turnNoteRequestId({ turnId: note.turnId }),
      entry: {
        kind: TURN_NOTE_ENTRY_KIND,
        model: [{ role: 'user', content, timestamp: DateTime.toEpochMillis(note.owedAt) }],
      },
    },
    BACKGROUND_CONTEXT,
  );
}

/** A turn note's request id, the one builder of its layout: the prefix, then the turn's id. */
function turnNoteRequestId({ turnId }: TurnNoteRequestIdInput): string {
  return `${TURN_NOTE_REQUEST_PREFIX}${turnId}`;
}
