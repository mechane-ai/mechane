import type { EntryId, EntryRecord, SubmissionRecord } from '@earendil-works/pi-durable';
import { Option } from 'effect';
import { PiSubmissionStatus, PiSubmissionType } from './constants.ts';
import { ItemPlaced, ItemWritten } from './schemas.ts';
import { submissionEnd } from './submission-end.ts';
import type { ItemProgress } from './types.ts';

type SubmissionProgressInput = {
  readonly record: SubmissionRecord;
  /** The answer entries the progress may read, by id. */
  readonly answers: ReadonlyMap<EntryId, EntryRecord>;
};

/**
 * How far pi has taken an inbox item, none while it waits in the queue. A write has no answer: it is written once pi
 * appended it, and only a write that names a head can go stale, which an item's write never does.
 */
export function submissionProgress({ record, answers }: SubmissionProgressInput): Option.Option<ItemProgress> {
  if (record.type === PiSubmissionType.Write) {
    return Option.liftPredicate(ItemWritten.make({}), () => record.status === PiSubmissionStatus.Done);
  }

  if (record.status === PiSubmissionStatus.Placed) {
    return Option.some(ItemPlaced.make({}));
  }

  return submissionEnd({ record, answers });
}
