import type { RemoteCallInput } from '@mechane/harness-tools';
import type { MechStore } from '@mechane/mech-store';
import type { MechId, WorkspaceId } from '@mechane/records';
import type { GrantedConnection, ObjectSettings } from '@mechane/rpc';
import type { Option } from 'effect';

export type MechRemoteToolsInput = { readonly store: MechStore; readonly settings: ObjectSettings };

export type RunGrantedToolInput = {
  readonly settings: ObjectSettings;
  readonly workspaceId: typeof WorkspaceId.Encoded;
  readonly mechId: typeof MechId.Encoded;
  readonly granted: GrantedConnection;
  /** None requests tool metadata without invoking a remote tool. */
  readonly invocation: Option.Option<Pick<RemoteCallInput, 'toolName' | 'arguments'>>;
  /** None leaves cancellation to the fixed operation deadline. */
  readonly signal: Option.Option<AbortSignal>;
};
