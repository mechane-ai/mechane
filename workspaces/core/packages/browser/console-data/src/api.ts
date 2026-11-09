import {
  BROWSER_CREDENTIAL,
  call,
  OperationFailed,
  OriginUnreachable,
  RequestTimedOut,
  ResponseUnreadable,
} from '@mechane/client';
import { ConsoleStorageFailed } from '@mechane/console-cache';
import { catalog, ErrorFamily } from '@mechane/protocol';
import type { OperationInput, OperationOutput } from '@mechane/protocol';
import { HttpMethod } from '@mechane/records';
import { Effect, Option, Result, Schema } from 'effect';
import type { Duration } from 'effect';
import {
  isTransientReadFailure,
  ReadResponseFailed,
  ReadTimedOut,
  recoverRead,
  REQUEST_TIMEOUT,
} from './read-recovery.ts';

/** The authenticated operations the console currently exposes. */
export type ConsoleOperation =
  | 'showPrincipal'
  | 'listWorkspaces'
  | 'listMechs'
  | 'showMech'
  | 'createMech'
  | 'updateMech'
  | 'sendNotification'
  | 'listConsoleMessages'
  | 'listTurns'
  | 'showTurn'
  | 'listTurnEvents'
  | 'cancelTurn'
  | 'listRecentEvents'
  | 'listMechRevisions'
  | 'listEvidence'
  | 'showEvidence'
  | 'listEnvironmentProcesses'
  | 'showEnvironmentProcess'
  | 'stopEnvironmentProcess'
  | 'showAllowance';

export type Input<N extends ConsoleOperation> = OperationInput<(typeof catalog)[N]>;
/** The decoded result of a catalog operation. */
export type Output<N extends ConsoleOperation> = OperationOutput<(typeof catalog)[N]>;

/** A cancelable browser call using the existing session cookie. */
export type ConsoleApi = <N extends ConsoleOperation>(
  name: N,
  input: Input<N>,
  signal?: AbortSignal,
) => Promise<Output<N>>;

const REMOVED_ACCESS: ReadonlySet<ErrorFamily> = new Set([
  ErrorFamily.Unauthenticated,
  ErrorFamily.Forbidden,
  ErrorFamily.NotFound,
]);

const SCOPE_FAILURE_FAMILIES: ReadonlySet<ErrorFamily> = new Set([ErrorFamily.Unauthenticated, ErrorFamily.Forbidden]);

const READ_FAILURE_SCOPES: ReadonlyMap<string, 'scope' | 'mech' | 'turn' | 'artifact'> = new Map([
  ['WorkspaceNotFound', 'scope'],
  ['MechNotFound', 'mech'],
  ['TurnNotFound', 'turn'],
  ['EvidenceNotFound', 'artifact'],
]);

const SESSION_CHANGES: ReadonlySet<string> = new Set(['IdentityNotAdmitted', 'WorkspaceNotFound']);

/** One Promise boundary for the browser libraries; the shared client owns wire validation and typed failures. */
export function createApi(origin: URL, lifetime: AbortSignal, onSessionEnded: (failure?: unknown) => void): ConsoleApi {
  return async function request<N extends ConsoleOperation>(
    name: N,
    input: Input<N>,
    signal?: AbortSignal,
  ): Promise<Output<N>> {
    const combined = signal === undefined ? lifetime : AbortSignal.any([lifetime, signal]);

    async function exchange(requestSignal: AbortSignal, timeout: Duration.Duration): Promise<Output<N>> {
      const operation = call({
        maxResponseBytes: Option.none(),
        name,
        input,
        credential: BROWSER_CREDENTIAL,
        origin,
        timeout,
        userAgent: 'mechane-console',
      });

      const result = await Effect.runPromise(Effect.result(operation), { signal: requestSignal });

      if (Result.isFailure(result)) {
        const failure = result.failure;

        if (failure instanceof OperationFailed && !lifetime.aborted) {
          const hasSessionChanged =
            failure.family === ErrorFamily.Unauthenticated || SESSION_CHANGES.has(failure.failure._tag);

          if (hasSessionChanged) {
            onSessionEnded(failure);
          }
        }

        throw failure;
      }

      return result.success;
    }

    return catalog[name].method === HttpMethod.Get
      ? await recoverRead({ signal: combined, read: exchange })
      : await exchange(combined, REQUEST_TIMEOUT);
  };
}

/** Only a local persistence failure can trigger automatic workspace reopening. */
export const isStorageFailure = Schema.is(ConsoleStorageFailed);

/** A safe user-facing explanation that does not expose transport details. */
export function problemMessage(error: unknown): string {
  if (error instanceof OriginUnreachable) {
    return 'Could not reach this Mechane installation. Check the connection and try again.';
  }

  if (isTransientReadFailure(error)) {
    return 'The service is temporarily unavailable. Try again in a moment.';
  }

  if (error instanceof ReadTimedOut) {
    return 'The service did not respond in time. Try again.';
  }

  if (error instanceof ReadResponseFailed) {
    return 'The conversation could not be loaded. Try again.';
  }

  if (error instanceof OperationFailed && error.failure._tag === 'EvidenceNotFound') {
    return 'This capture is no longer available.';
  }

  if (error instanceof OperationFailed || Schema.is(ConsoleStorageFailed)(error)) {
    return error.message;
  }

  if (error instanceof RequestTimedOut || error instanceof ResponseUnreadable) {
    return 'The server did not confirm the result. Refresh before making changes; retrying this message or creation uses the same request ID.';
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return 'The request was canceled.';
  }

  return 'Could not load this data. Try again.';
}

/** A conflicting edit must be reconciled against the newer saved definition. */
export function isRevisionConflict(error: unknown): boolean {
  return error instanceof OperationFailed && error.failure._tag === 'MechRevisionConflict';
}

/** Whether loading a session failed because its credential is no longer valid. */
export function isSignedOut(error: unknown): boolean {
  return error instanceof OperationFailed && error.family === ErrorFamily.Unauthenticated;
}

/** Transient failures may retain a snapshot; authorization or removal failures must hide it. */
export function canRetainResult(error: unknown): boolean {
  return !(error instanceof OperationFailed && REMOVED_ACCESS.has(error.family));
}

/** The smallest confirmed removal boundary; undefined leaves admitted content available. */
export function readFailureScope(error: unknown): 'scope' | 'mech' | 'turn' | 'artifact' | 'request' | undefined {
  if (!(error instanceof OperationFailed)) {
    return undefined;
  }

  if (SCOPE_FAILURE_FAMILIES.has(error.family)) {
    return 'scope';
  }

  const scope = READ_FAILURE_SCOPES.get(error.failure._tag);

  if (scope !== undefined) {
    return scope;
  }

  return error.family === ErrorFamily.NotFound ? 'request' : undefined;
}
