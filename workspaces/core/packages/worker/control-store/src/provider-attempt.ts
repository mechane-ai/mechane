export type ProviderAttemptScope = { readonly id: string; readonly workspaceId: string; readonly mechId: string };

export type ProviderAttemptsScope = {
  readonly ids: ReadonlyArray<string>;
  readonly workspaceId: string;
  readonly mechId: string;
};

export type ProviderAttemptIdentity = ProviderAttemptScope & {
  readonly activationId: string;
  readonly generationTaskId?: string;
  readonly attemptOrdinal: number;
  readonly requestFingerprint: string;
  readonly provider: string;
  readonly model: string;
  readonly reservedMicros: number;
};

export type ProviderAttemptRefusal = 'workspace_suspended' | 'mech_disabled' | 'workspace_allowance' | 'mech_allowance';

export type ProviderAttemptState = 'reserved' | 'dispatched' | 'settled' | 'released' | 'refused';
export type ProviderUsage = Readonly<Record<string, unknown>>;

export type ProviderAttempt = ProviderAttemptScope & {
  readonly activationId: string;
  readonly generationTaskId: string | null;
  readonly attemptOrdinal: number;
  readonly requestFingerprint: string;
  readonly provider: string;
  readonly model: string;
  readonly reservedMicros: number;
  readonly accountingDate: string;
  readonly actualMicros: number | null;
  readonly upstreamUsage: ProviderUsage | null;
  readonly state: ProviderAttemptState;
  readonly refusalReason: ProviderAttemptRefusal | null;
  readonly createdAt: string;
  readonly dispatchedAt: string | null;
  readonly settledAt: string | null;
  readonly releasedAt: string | null;
};

export type ProviderAttemptDecision =
  | { readonly status: 'admitted'; readonly attempt: ProviderAttempt; readonly wasCreated: boolean }
  | {
      readonly status: 'refused';
      readonly reason: ProviderAttemptRefusal;
      readonly attempt: ProviderAttempt;
      readonly wasCreated: boolean;
    };

export type ProviderAttemptDispatch = ProviderAttempt & { readonly wasMarked: boolean };

export type DispatchProviderAttempt = ProviderAttemptScope & { readonly requestFingerprint: string };
export type ReleaseUnusedProviderAttempt = DispatchProviderAttempt;

export type SettleProviderAttempt = DispatchProviderAttempt & {
  readonly actualMicros: number;
  readonly upstreamUsage: ProviderUsage;
};

export type ProviderAttemptStore = {
  readonly reserveProviderAttempt: (input: ProviderAttemptIdentity) => Promise<ProviderAttemptDecision>;
  readonly getProviderAttempt: (input: ProviderAttemptScope) => Promise<ProviderAttempt | null>;
  readonly getProviderAttempts: (input: ProviderAttemptsScope) => Promise<ReadonlyArray<ProviderAttempt | null>>;
  readonly markProviderAttemptDispatched: (input: DispatchProviderAttempt) => Promise<ProviderAttemptDispatch>;
  readonly releaseUnusedProviderAttempt: (input: ReleaseUnusedProviderAttempt) => Promise<ProviderAttempt>;
  readonly settleProviderAttempt: (input: SettleProviderAttempt) => Promise<ProviderAttempt>;
};
