import type { heartbeatConflict } from './work-heartbeat.ts';

export type ManagedScope = {
  readonly workspaceId: string;
  readonly principalId: string;
  readonly isAdmin: boolean;
  readonly apiKeyId?: string;
  readonly actorIdentity?: { readonly issuer: string; readonly subject: string };
};

export type ManagedDocument = Readonly<Record<string, unknown>>;
export type ManagedPage = { readonly data: ReadonlyArray<ManagedDocument>; readonly next_page: string | null };

export type ManagedPageQuery = {
  readonly page?: string;
  readonly maxRows?: number;
  readonly includeArchived?: boolean;
  readonly createdAfter?: string;
  readonly createdBefore?: string;
  readonly createdAfterExclusive?: string;
  readonly createdBeforeExclusive?: string;
};

type MemoryPathConflictDetails = {
  readonly type: 'memory_path_conflict_error';
  readonly conflicting_path: string;
  readonly conflicting_memory_id: string;
};

type MemoryPreconditionFailedDetails = { readonly type: 'memory_precondition_failed_error' };

export type ManagedConflictDetails =
  | ReturnType<typeof heartbeatConflict>
  | MemoryPathConflictDetails
  | MemoryPreconditionFailedDetails;
