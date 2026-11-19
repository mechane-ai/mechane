import { HttpStatusCode, renamedWireStruct } from '@mechane/records';
import type { ManagedWorkerClaim } from '@mechane/sandbox-wire';
import { Duration, Option, Result, Schema } from 'effect';

const Heartbeat = renamedWireStruct({
  fields: { isLeaseExtended: Schema.Boolean, state: Schema.String },
  renames: { isLeaseExtended: 'lease_extended' },
});

const ACTIVE = 'active';
const WorkAction = { Heartbeat: 'heartbeat', Stop: 'stop' } as const;
const INITIAL_HEARTBEAT_TIMEOUT = Duration.minutes(1);

const LOST_LEASE: ReadonlySet<number> = new Set([
  HttpStatusCode.Unauthorized,
  HttpStatusCode.Forbidden,
  HttpStatusCode.NotFound,
  HttpStatusCode.PreconditionFailed,
]);

type WorkIdentity = Pick<ManagedWorkerClaim, 'environmentId' | 'workId'>;
type WorkPathInput = WorkIdentity & { readonly action: (typeof WorkAction)[keyof typeof WorkAction] };
type Admission = { readonly isActive: boolean };
type FetchInput = Parameters<typeof fetch>[0];
type NativeRequest = { readonly input: FetchInput };
type RequestSignals = NativeRequest & { readonly init: RequestInit; readonly signal: AbortSignal };
type SessionIdentity = Pick<ManagedWorkerClaim, 'sessionId'>;
type LeaseTransportInput = WorkIdentity & SessionIdentity & { readonly origin: string; readonly signal: AbortSignal };

function environmentWorkPath({ environmentId, workId, action }: WorkPathInput): string {
  return `/v1/environments/${environmentId}/work/${workId}/${action}`;
}

function sessionPath({ sessionId }: SessionIdentity): string {
  return `/v1/sessions/${sessionId}`;
}

function sessionStreamPath({ sessionId }: SessionIdentity): string {
  return `/v1/sessions/${sessionId}/events/stream`;
}

function requestUrl({ input }: NativeRequest): URL {
  if (typeof input === 'string') {
    return new URL(input);
  }

  if ('url' in input) {
    return new URL(input.url);
  }

  return new URL(input.href);
}

// Node can collect a copied Request’s follower signal after headers arrive. Use the original signal for the stream.
function combinedRequestSignal({ input, init, signal }: RequestSignals): AbortSignal {
  const explicit = Option.fromNullishOr(init.signal);

  if (Option.isSome(explicit)) {
    return AbortSignal.any([explicit.value, signal]);
  }

  if (typeof input === 'object' && 'signal' in input) {
    return AbortSignal.any([input.signal, signal]);
  }

  return signal;
}

export function leaseTransport({
  origin,
  environmentId,
  workId,
  sessionId,
  signal,
}: LeaseTransportInput): typeof fetch {
  const base = new URL(origin).origin;
  const heartbeatPath = environmentWorkPath({ environmentId, workId, action: WorkAction.Heartbeat });
  const stopPath = environmentWorkPath({ environmentId, workId, action: WorkAction.Stop });
  const metadata = sessionPath({ sessionId });
  const stream = sessionStreamPath({ sessionId });
  const firstHeartbeat = Promise.withResolvers<boolean>();

  // The SDK fetches session metadata without the heartbeat loop's abort signal.
  const timeoutMs = Duration.toMillis(INITIAL_HEARTBEAT_TIMEOUT);
  const timeout = AbortSignal.timeout(timeoutMs);
  const deadline = AbortSignal.any([signal, timeout]);

  function settle({ isActive }: Admission): void {
    deadline.removeEventListener('abort', abandon);
    firstHeartbeat.resolve(isActive);
  }

  function abandon(): void {
    settle({ isActive: false });
  }

  if (deadline.aborted) {
    abandon();
  } else {
    deadline.addEventListener('abort', abandon, { once: true });
  }

  return async (input, init = {}) => {
    const url = requestUrl({ input });

    if (url.origin !== base) {
      return new Response(null, { status: HttpStatusCode.Forbidden });
    }

    if (url.pathname === stopPath) {
      return await fetch(input, { ...init, redirect: 'error' });
    }

    if (url.pathname === heartbeatPath) {
      const activeSignal = combinedRequestSignal({ input, init, signal });
      const response = await fetch(input, { ...init, redirect: 'error', signal: activeSignal });

      if (response.ok) {
        const body: unknown = await response.clone().json();
        const heartbeat = Schema.decodeUnknownResult(Heartbeat)(body);

        const isActive =
          Result.isSuccess(heartbeat) && heartbeat.success.isLeaseExtended && heartbeat.success.state === ACTIVE;

        settle({ isActive });
      } else if (LOST_LEASE.has(response.status)) {
        abandon();
      }

      return response;
    }

    if (!(await firstHeartbeat.promise)) {
      return new Response(null, { status: HttpStatusCode.Forbidden });
    }

    // Bind the stream body through cancellation; the SDK may still flush dirty memory using its own deadline.
    if (url.pathname === metadata || url.pathname === stream) {
      const activeSignal = combinedRequestSignal({ input, init, signal });

      return await fetch(input, { ...init, redirect: 'error', signal: activeSignal });
    }

    return await fetch(input, { ...init, redirect: 'error' });
  };
}
