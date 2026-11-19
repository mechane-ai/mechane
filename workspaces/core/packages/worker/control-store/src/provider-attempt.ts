export type ProviderAttemptScope = { readonly id: string; readonly workspaceId: string; readonly mechId: string };

export type ProviderAttemptsScope = {
  readonly ids: ReadonlyArray<string>;
  readonly workspaceId: string;
  readonly mechId: string;
};

type ManagedAttemptScope = { readonly sessionId: string; readonly threadId: string };

export type ProviderAttemptIdentity = ProviderAttemptScope & {
  readonly activationId: string;
  readonly generationTaskId?: string;
  readonly managed?: ManagedAttemptScope;
  readonly attemptOrdinal: number;
  readonly requestFingerprint: string;
  readonly provider: string;
  readonly model: string;
  readonly reservedMicros: number;
};

export type ManagedProviderAttemptIdentity = Omit<ProviderAttemptIdentity, 'managed' | 'attemptOrdinal'> & {
  readonly managed: ManagedAttemptScope;
};

export type ProviderAttemptRefusal =
  | 'workspace_suspended'
  | 'mech_disabled'
  | 'workspace_allowance'
  | 'mech_allowance'
  | 'session_budget';

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
  readonly sessionId: string | null;
  readonly threadId: string | null;
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
export type MarkProviderAttemptDispatched = DispatchProviderAttempt & { readonly usageTimeoutMs?: number };
export type ReleaseUnusedProviderAttempt = DispatchProviderAttempt;

export type SettleProviderAttempt = DispatchProviderAttempt & {
  readonly actualMicros: number;
  readonly upstreamUsage: ProviderUsage;
  readonly listCostPicodollars?: string | null;
};

export type ProviderAttemptStore = {
  readonly reserveManagedProviderAttempt: (input: ManagedProviderAttemptIdentity) => Promise<ProviderAttemptDecision>;
  readonly reserveProviderAttempt: (input: ProviderAttemptIdentity) => Promise<ProviderAttemptDecision>;
  readonly getProviderAttempt: (input: ProviderAttemptScope) => Promise<ProviderAttempt | null>;
  readonly getProviderAttempts: (input: ProviderAttemptsScope) => Promise<ReadonlyArray<ProviderAttempt | null>>;
  readonly markProviderAttemptDispatched: (input: MarkProviderAttemptDispatched) => Promise<ProviderAttemptDispatch>;
  readonly markManagedUsageUnconfirmed: (input: DispatchProviderAttempt) => Promise<ProviderAttempt>;
  readonly releaseUnsentManagedDispatch: (input: DispatchProviderAttempt) => Promise<ProviderAttempt>;
  readonly releaseUnusedProviderAttempt: (input: ReleaseUnusedProviderAttempt) => Promise<ProviderAttempt>;
  readonly settleProviderAttempt: (input: SettleProviderAttempt) => Promise<ProviderAttempt>;
};
