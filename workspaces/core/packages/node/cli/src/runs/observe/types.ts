import type { ResultRecord } from '@mechane/cli-kernel';
import type { OperationCall } from '@mechane/client';
import type { CommandInput } from '@mechane/commands';
import type { WorkspaceAccess } from '@mechane/eval';

/** The archive page to read and the writer used for each event. */
export type EventPageInput = Pick<CommandInput<'history events'>, 'mechId' | 'after'> & {
  readonly call: OperationCall<'listEvents'>;
  readonly access: WorkspaceAccess;
  /** The writer the output module hands `history events`, which writes each event as one record. */
  readonly write: (input: ResultRecord<'history events'>) => void;
};
