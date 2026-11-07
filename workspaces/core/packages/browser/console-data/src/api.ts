import {
  BROWSER_CREDENTIAL,
  call,
  OperationFailed,
  OriginUnreachable,
  RequestTimedOut,
  ResponseUnreadable,
} from '@mechane/client';
import { ConsoleStorageFailed } from '@mechane/console-cache';
import { ErrorFamily } from '@mechane/protocol';
import type { catalog, OperationInput, OperationOutput } from '@mechane/protocol';
import { Duration, Effect, Option, Result, Schema } from 'effect';

/** The authenticated operations the console currently exposes. */
export type ConsoleOperation =
  | 'showPrincipal'
  | 'listWorkspaces'
  | 'listMechs'
  | 'showMech'
  | 'createMech'
  | 'updateMech'
  | 'sendInboxItem'
  | 'listTurns'
  | 'showTurn'
  | 'listTurnEvents'
  | 'cancelTurn'
  | 'listRecentEvents'
  | 'listMechRevisions'
  | 'listThreads'
  | 'listSessions'
  | 'listSlackBindings'
  | 'listSlackDeliveries'
  | 'listMemories'
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
const REQUEST_TIMEOUT = Duration.seconds(40);

/** One Promise boundary for the browser libraries; the shared client owns wire validation and typed failures. */
export function createApi(origin: URL, lifetime: AbortSignal, onSessionEnded: (failure?: unknown) => void): ConsoleApi {
  return async function request<N extends ConsoleOperation>(
    name: N,
    input: Input<N>,
    signal?: AbortSignal,
  ): Promise<Output<N>> {
    const combined = signal === undefined ? lifetime : AbortSignal.any([lifetime, signal]);

    const maxResponseBytes = Option.none();

    const operation = call({
      maxResponseBytes,
      name,
      input,
      credential: BROWSER_CREDENTIAL,
      origin,
      timeout: REQUEST_TIMEOUT,
      userAgent: 'mechane-console',
    });

    const captured = Effect.result(operation);
    const result = await Effect.runPromise(captured, { signal: combined });

    if (Result.isFailure(result)) {
      const failure = result.failure;

      if (failure instanceof OperationFailed && !lifetime.aborted) {
        const hasSessionChanged =
          failure.family === ErrorFamily.Unauthenticated || SESSION_CHANGES.has(failure.failure._tag);

        if (hasSessionChanged) {
          onSessionEnded(failure);
        }
      }

      throw result.failure;
    }

    return result.success;
  };
}

/** A safe user-facing explanation that does not expose transport details. */
export function problemMessage(error: unknown): string {
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

  if (error instanceof OriginUnreachable) {
    return 'Could not reach this Mechane installation. Check the connection and try again.';
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
