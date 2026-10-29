import type { EntryId, EntryRecord, SubmissionRecord } from '@earendil-works/pi-durable';
import { RandomId } from '@mechane/records';
import { Option, Schema } from 'effect';
import { PiChangeType } from './constants.ts';
import { requestedChanges } from './requested-changes.ts';
import type { ChangesInput, PublicationInput, RequestedSubmission } from './types.ts';

/** A commit, and the answer entries its settled inputs may name. */
type ItemChangesInput = PublicationInput & { readonly answers: ReadonlyMap<EntryId, EntryRecord> };

/**
 * The inbox items and the drones' briefs one pi commit moved, with the answer entries they may have settled with. Only
 * an item's request id or a drone's is a random UUID, so a turn note is neither. Change order is unspecified.
 */
export function itemChanges({ publication, answers }: ItemChangesInput): ChangesInput {
  const requestedSubmission: (record: SubmissionRecord) => ReadonlyArray<RequestedSubmission> = (record) => {
    const requestId = Option.filter(Option.fromNullishOr(record.requestId), Schema.is(RandomId));

    return Option.toArray(Option.map(requestId, (id) => ({ requestId: id, record })));
  };

  const requested = publication.changes
    .filter((change) => change.type === PiChangeType.Submission)
    .map((change) => change.value)
    .flatMap(requestedSubmission);

  return requestedChanges({ requested, answers });
}
