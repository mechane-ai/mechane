import type { AssistantMessage, TranscriptContext } from '@earendil-works/pi-ai';
import type { ControlStore } from '@mechane/control-store';
import type { RuntimeConfiguration } from '../config.ts';
import type { RawUsage } from '../models/gateway.ts';
import type { ManagedModelOptions } from '../models/model-effort.ts';

export type ManagedExecution = ManagedModelOptions & {
  readonly runtimeMechId: string;
  readonly activationId: string;
  readonly sessionId: string;
  readonly threadId: string;
  readonly eventId: string;
  readonly providerSessionId: string;
  readonly epoch: number;
  readonly model: string;
  readonly webTools?: ReadonlyArray<Readonly<Record<string, unknown>>> | undefined;
};

type ProviderControl = <T>(operation: (store: ControlStore) => Promise<T>) => Promise<T>;
type CurrentExecution = () => Promise<ManagedExecution>;

export type ModelSpanResult = {
  readonly isError: boolean;
  readonly usage: RawUsage | null;
  readonly message?: AssistantMessage;
  readonly errorDetail?: string | undefined;
};

type ManagedModelSpan = { readonly finish: (result: ModelSpanResult) => Promise<void> };

export type BeginManagedModelSpan = (
  execution: ManagedExecution,
  attemptId: string,
  signal?: AbortSignal,
) => Promise<ManagedModelSpan>;

export type ManagedRequest = {
  readonly configuration: RuntimeConfiguration;
  readonly workspaceId: string;
  readonly current: CurrentExecution;
  readonly withControl: ProviderControl;
  readonly beginModelSpan: BeginManagedModelSpan;
  readonly hydrateCompaction?: (input: {
    readonly transcript: TranscriptContext;
    readonly providerSessionId: string;
  }) => Promise<TranscriptContext>;
};

export type ManagedProviderOwner = Omit<ManagedRequest, 'current'> & {
  readonly withRequest: <T>(
    sessionId: string,
    signal: AbortSignal | undefined,
    run: (current: CurrentExecution, requestSignal: AbortSignal) => Promise<T>,
  ) => Promise<T>;
};
