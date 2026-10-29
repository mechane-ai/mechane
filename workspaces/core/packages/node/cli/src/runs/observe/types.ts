import type { ResultRecord } from '@mechane/cli-kernel';
import type { OperationCall } from '@mechane/client';
import type { CommandInput } from '@mechane/commands';
import type { WorkspaceAccess } from '@mechane/eval';
import type { Duration } from 'effect';

/** The events of a mech to write after the cursor `after`, whether the listing follows, and how pages are listed. */
export type EventPageInput = Pick<CommandInput<'event list'>, 'mechId' | 'after' | 'isFollowing'> & {
  readonly call: OperationCall<'listEvents'>;
  readonly access: WorkspaceAccess;
  /** How long the page waits for an event, which a follower asks the most of and a listing none of. */
  readonly wait: Duration.Duration;
  /** The writer the output module hands `event list`, which writes each event as one record. */
  readonly write: (input: ResultRecord<'event list'>) => void;
};
