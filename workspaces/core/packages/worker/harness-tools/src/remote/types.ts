import type { RemoteToolsOutcome } from '@mechane/protocol';
import type { ConnectionId } from '@mechane/records';
import type { Option } from 'effect';

export type RemoteListInput = {
  /** None lists granted connections; a value requests that connection's remote metadata. */
  readonly connectionId: Option.Option<ConnectionId>;
  /** None leaves cancellation to the fixed operation deadline. */
  readonly signal: Option.Option<AbortSignal>;
};

export type RemoteCallInput = {
  readonly connectionId: ConnectionId;
  readonly toolName: string;
  readonly arguments: Readonly<Record<string, unknown>>;
  /** None leaves cancellation to the fixed operation deadline. */
  readonly signal: Option.Option<AbortSignal>;
};

export type RemoteToolRunInput<Arguments> = {
  readonly arguments: Arguments;
  /** None leaves cancellation to the fixed operation deadline. */
  readonly signal: Option.Option<AbortSignal>;
};

/** A decoded remote declaration delegates to the trusted host with its cancellation signal. */
export type RemoteToolRun<Arguments> = (input: RemoteToolRunInput<Arguments>) => Promise<RemoteToolsOutcome>;

/** The trusted host owns authorization and credentials behind this model-facing port. */
export type RemoteTools = {
  readonly list: (input: RemoteListInput) => Promise<RemoteToolsOutcome>;
  readonly call: (input: RemoteCallInput) => Promise<RemoteToolsOutcome>;
};
