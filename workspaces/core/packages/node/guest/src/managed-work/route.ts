import { RequestInvalid } from '@mechane/protocol';
import type { RouteNotFound } from '@mechane/protocol';
import { Bytes, HttpMethod, HttpStatusCode } from '@mechane/records';
import { MANAGED_WORK_FINGERPRINT_HEADER, MANAGED_WORK_MAX_BYTES, ManagedWorkerClaim } from '@mechane/sandbox-wire';
import { Effect, Schema } from 'effect';
import type { IncomingMessage } from 'node:http';
import { readGuestBody } from '../read-guest-body.ts';
import type { ServedAnswer } from '../types.ts';
import type { ManagedWorkLauncher } from './launch.ts';

type RouteInput = {
  readonly method: string;
  readonly rest: ReadonlyArray<string>;
  readonly request: IncomingMessage;
  readonly notFound: RouteNotFound;
  readonly launch: ManagedWorkLauncher;
};

const ClaimJson = Schema.fromJsonString(ManagedWorkerClaim);
const MaximumClaimBytes = Bytes.make(MANAGED_WORK_MAX_BYTES);
const unavailable = { status: HttpStatusCode.Unavailable, headers: {}, body: '' } as const;
const noContent = { status: HttpStatusCode.NoContent, headers: {}, body: '' } as const;

type LauncherCall = { readonly run: () => Promise<boolean> };

const checkProcess = Effect.fn('checkProcess')(function* ({ run }: LauncherCall): Effect.fn.Return<boolean> {
  const pending = Effect.tryPromise({
    try: () => run(),
    catch: () => new RequestInvalid({ reason: 'Managed worker process is unavailable' }),
  });

  return yield* pending.pipe(Effect.catchTags({ RequestInvalid: () => Effect.succeed(false) }));
});

function invalid(): RequestInvalid {
  return new RequestInvalid({ reason: 'Invalid managed worker claim' });
}

export const routeManagedWork = Effect.fn('routeManagedWork')(function* ({
  method,
  rest,
  request,
  notFound,
  launch,
}: RouteInput): Effect.fn.Return<ServedAnswer, RequestInvalid | RouteNotFound> {
  if (rest.length > 0) {
    return yield* notFound;
  }

  if (method === HttpMethod.Head) {
    const digest = request.headers[MANAGED_WORK_FINGERPRINT_HEADER];

    if (typeof digest === 'string') {
      const observed = yield* checkProcess({ run: () => launch.observed({ digest }) });

      if (observed) {
        return noContent;
      }
    }

    return { status: HttpStatusCode.NotFound, headers: {}, body: '' };
  }

  if (method === HttpMethod.Delete) {
    const stopped = yield* checkProcess({ run: launch.quiesce });

    if (stopped) {
      return noContent;
    }

    return unavailable;
  }

  if (method !== HttpMethod.Post) {
    return yield* notFound;
  }

  const bytes = yield* readGuestBody({ request, maximumBytes: MaximumClaimBytes, onLimit: invalid, onError: invalid });
  const json = bytes.toString('utf8');
  const claim = yield* Schema.decodeUnknownEffect(ClaimJson)(json).pipe(Effect.mapError(invalid));
  const admitted = yield* checkProcess({ run: () => launch.start({ claim }) });

  if (admitted) {
    return { status: HttpStatusCode.Accepted, headers: {}, body: '' };
  }

  return unavailable;
});
