import type { ConnectionConfiguration } from '@mechane/protocol';
import type { ConnectionId } from '@mechane/records';
import type { DateTime } from 'effect';

export type SaveConnectionInput = {
  readonly connectionId: ConnectionId;
  readonly configuration: ConnectionConfiguration;
  readonly isCreating: boolean;
  readonly now: DateTime.Utc;
};
