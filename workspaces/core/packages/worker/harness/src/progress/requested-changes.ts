import { ROOT_CONVERSATION_ID } from '@earendil-works/pi-durable';
import type { EntryId, EntryRecord } from '@earendil-works/pi-durable';
import { DroneId } from '@mechane/records';
import { Option } from 'effect';
import { PiSubmissionType } from './constants.ts';
import { submissionEnd } from './submission-end.ts';
import { submissionProgress } from './submission-progress.ts';
import type { BriefEnd, ChangesInput, ItemChange, RequestedSubmission } from './types.ts';

/** The submissions under callers' request ids, and the answer entries they may name. */
type RequestedChangesInput = {
  readonly requested: ReadonlyArray<RequestedSubmission>;
  readonly answers: ReadonlyMap<EntryId, EntryRecord>;
};

/**
 * How far pi took submissions whose request ids callers made. One of the mech's own conversation is an inbox item's,
 * and an input of any other is a drone's brief under the drone's id, whose end alone moves the drone.
 */
export function requestedChanges({ requested, answers }: RequestedChangesInput): ChangesInput {
  const itemChange: (submission: RequestedSubmission) => ReadonlyArray<ItemChange> = ({ requestId, record }) => {
    const progress = submissionProgress({ record, answers });

    return Option.toArray(Option.map(progress, (moved) => ({ inboxItemId: requestId, progress: moved })));
  };

  const briefEnd: (submission: RequestedSubmission) => ReadonlyArray<BriefEnd> = ({ requestId, record }) => {
    if (record.type !== PiSubmissionType.Input) {
      return [];
    }

    const end = submissionEnd({ record, answers });

    if (Option.isNone(end)) {
      return [];
    }

    return [{ droneId: DroneId.make(requestId), progress: end.value }];
  };

  return {
    changes: requested.filter(({ record }) => record.conversationId === ROOT_CONVERSATION_ID).flatMap(itemChange),
    droneEnds: requested.filter(({ record }) => record.conversationId !== ROOT_CONVERSATION_ID).flatMap(briefEnd),
  };
}
