import { decodeRequestPart } from '@mechane/protocol';
import type { RequestInvalid, RouteNotFound } from '@mechane/protocol';
import { HttpMethod, SourceId } from '@mechane/records';
import { SourceStep } from '@mechane/sandbox-wire';
import { Effect, Schema } from 'effect';
import type { IncomingMessage } from 'node:http';
import type { SourceGuestFailed } from '../../errors.ts';
import type { ServedAnswer, SourceJournal } from '../../types.ts';

/** A source request after the machine route, with the journal that owns its fence. */
type RouteSourceInput = {
  readonly request: IncomingMessage;
  readonly method: string;
  readonly rest: ReadonlyArray<string>;
  readonly source: SourceJournal;
  readonly notFound: RouteNotFound;
};

/** Every source route names both the source and the generation admitted to this guest. */
const SourceRoute = Schema.Tuple([SourceId, SourceId, Schema.Enum(SourceStep)]);

/** Decodes a source operation before the journal admits it into the active generation. */
export const routeSource = Effect.fn('routeSource')(function* ({
  request,
  method,
  rest,
  source,
  notFound,
}: RouteSourceInput): Effect.fn.Return<ServedAnswer, RouteNotFound | RequestInvalid | SourceGuestFailed> {
  if (method !== HttpMethod.Post) {
    return yield* notFound;
  }

  const [sourceId, generation, step] = yield* decodeRequestPart({ schema: SourceRoute, value: rest });

  return yield* source.answer({ sourceId, generation, step, request });
});
