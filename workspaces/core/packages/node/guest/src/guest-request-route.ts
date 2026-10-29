import { decodeRequestPart, RouteNotFound } from '@mechane/protocol';
import type { RequestInvalid } from '@mechane/protocol';
import type { RecordId } from '@mechane/records';
import { GuestSegment } from '@mechane/sandbox-wire';
import { Effect, Option, Schema } from 'effect';
import type { IncomingMessage } from 'node:http';

const REQUEST_BASE = 'http://guest.invalid';
const RequestLine = Schema.Struct({ method: Schema.String, url: Schema.String });
type RequestLine = typeof RequestLine.Type;
type GuestRequestRouteInput = { readonly request: IncomingMessage; readonly machineId: RecordId };

type GuestRequestRoute = {
  readonly method: string;
  readonly url: URL;
  readonly resource: string;
  readonly rest: ReadonlyArray<string>;
  readonly notFound: RouteNotFound;
};

/** Decodes a guest URL and refuses paths that address another machine identity. */
export const guestRequestRoute = Effect.fn('guestRequestRoute')(function* ({
  request,
  machineId,
}: GuestRequestRouteInput): Effect.fn.Return<GuestRequestRoute, RouteNotFound | RequestInvalid> {
  const line = { method: request.method, url: request.url };
  const { method, url } = yield* decodeRequestPart({ schema: RequestLine, value: line });
  const parsed = URL.parse(url, REQUEST_BASE);
  const known = Option.fromNullishOr(parsed);

  if (Option.isNone(known)) {
    return yield* new RouteNotFound({ method, path: url });
  }

  const path = known.value.pathname;
  const encodedSegments = path.split('/');

  const segments = yield* Effect.try({
    try: () => encodedSegments.map(decodeURIComponent),
    catch: () => new RouteNotFound({ method, path }),
  });

  const [root, machines, requestedMachine, resource = '', ...rest] = segments;
  const notFound = new RouteNotFound({ method, path });

  if (root !== '' || machines !== GuestSegment.Machines || requestedMachine !== machineId) {
    return yield* notFound;
  }

  return { method, url: known.value, resource, rest, notFound };
});
