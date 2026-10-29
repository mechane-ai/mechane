import type { ConnectionConfiguration } from '@mechane/protocol';
import type { ConnectionId, MechId } from '@mechane/records';

export type ConnectionIdInput = { readonly connectionId: typeof ConnectionId.Encoded };

export type SaveConnectionInput = ConnectionIdInput & {
  readonly configuration: typeof ConnectionConfiguration.Encoded;
  readonly isCreating: boolean;
};

export type GrantToolsInput = ConnectionIdInput & {
  readonly mechId: typeof MechId.Encoded;
  readonly tools: ReadonlyArray<string>;
};

export type MechConnectionInput = ConnectionIdInput & { readonly mechId: typeof MechId.Encoded };
