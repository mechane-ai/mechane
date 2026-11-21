import type { AssistantMessage, TranscriptContext } from '@earendil-works/pi-ai';
import type { ProviderAttemptStore } from '@mechane/authority-store';
import type { RawUsage } from './gateway.ts';
import type { ManagedModelOptions } from './model-effort.ts';
import type { ModelGatewayConfiguration } from './offers.ts';

export type ModelGatewayControlStore = Pick<
  ProviderAttemptStore,
  | 'getProviderAttempt'
  | 'markProviderAttemptDispatched'
  | 'releaseUnusedProviderAttempt'
  | 'reserveManagedProviderAttempt'
  | 'releaseUnsentManagedDispatch'
  | 'markManagedUsageUnconfirmed'
  | 'settleProviderAttempt'
> & {
  readonly managed: {
    readonly sessions: {
      readonly assertionContext: (scope: {
        readonly workspaceId: string;
        readonly id: string;
        readonly runtimeMechId: string;
        readonly forwardMetadata: ReadonlyArray<string>;
      }) => Promise<Readonly<Record<string, unknown>>>;
    };
  };
};

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

type ProviderControl = <T>(operation: (store: ModelGatewayControlStore) => Promise<T>) => Promise<T>;
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
  readonly configuration: ModelGatewayConfiguration;
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
