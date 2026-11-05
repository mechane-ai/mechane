import { BROWSER_CREDENTIAL, call, OperationFailed, RequestTimedOut, ResponseUnreadable } from '@mechane/client';
import { ErrorFamily } from '@mechane/protocol';
import type { catalog, OperationInput, OperationOutput } from '@mechane/protocol';
import { Duration, Effect, Option, Result } from 'effect';

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
  | 'listSlackBindings'
  | 'listSlackDeliveries'
  | 'listMemories'
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

const SESSION_CHANGES: ReadonlySet<string> = new Set(['IdentityNotAdmitted', 'WorkspaceNotFound']);
const REQUEST_TIMEOUT = Duration.seconds(40);

/** One Promise boundary for the browser libraries; the shared client owns wire validation and typed failures. */
export function createApi(origin: URL, lifetime: AbortSignal, onSessionEnded: () => void): ConsoleApi {
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
        const sessionChanged =
          failure.family === ErrorFamily.Unauthenticated || SESSION_CHANGES.has(failure.failure._tag);

        if (sessionChanged) {
          onSessionEnded();
        }
      }

      throw result.failure;
    }

    return result.success;
  };
}

/** A safe user-facing explanation that does not expose transport details. */
export function problemMessage(error: unknown): string {
  if (error instanceof OperationFailed) {
    return error.message;
  }

  if (error instanceof RequestTimedOut || error instanceof ResponseUnreadable) {
    return 'The server did not confirm the result. Refresh before making changes; retrying this message or creation uses the same request ID.';
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return 'The request was canceled.';
  }

  return 'Could not reach this Mechane installation. Check the connection and try again.';
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
