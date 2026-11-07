import { decodeRequestPart, RequestInvalid } from '@mechane/protocol';
import type { RouteNotFound } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import { ProcessId, ProcessObservation, ProcessStart, ProcessSummaries } from '@mechane/sandbox-wire';
import { Effect, Option, Schema } from 'effect';
import type { IncomingMessage } from 'node:http';
import { readExecutionBody } from '../executions/read-execution-body.ts';
import type { ServedAnswer } from '../types.ts';
import type { ProcessFailed } from './process-failed.ts';
import type { ProcessLedger } from './types.ts';

type RouteProcessInput = {
  readonly request: IncomingMessage;
  readonly method: string;
  readonly rest: ReadonlyArray<string>;
  readonly processes: ProcessLedger;
  readonly notFound: RouteNotFound;
};

const HEADERS = { [HttpHeader.ContentType]: MediaType.Json } as const;

/** Serves starts, bounded summary lists, and exact-handle reads or stops on the current guest. */
export const routeProcess = Effect.fn('routeProcess')(function* ({
  request,
  method,
  rest,
  processes,
  notFound,
}: RouteProcessInput): Effect.fn.Return<ServedAnswer, RouteNotFound | RequestInvalid | ProcessFailed> {
  if (rest.length === 0 && method === HttpMethod.Get) {
    const observations = processes.list();
    const schema = Schema.fromJsonString(ProcessSummaries);
    const body = Schema.encodeSync(schema)(observations);

    return { status: HttpStatusCode.Ok, headers: HEADERS, body };
  }

  if (rest.length !== 1) {
    return yield* notFound;
  }

  const processId = yield* decodeRequestPart({ schema: ProcessId, value: rest[0] });
  const observation = yield* answerProcess({ request, method, processId, processes, notFound });
  const schema = Schema.fromJsonString(ProcessObservation);
  const body = Schema.encodeSync(schema)(observation);

  return { status: HttpStatusCode.Ok, headers: HEADERS, body };
});

type AnswerProcessInput = Omit<RouteProcessInput, 'rest'> & { readonly processId: ProcessId };

const answerProcess = Effect.fn('answerProcess')(function* ({
  request,
  method,
  processId,
  processes,
  notFound,
}: AnswerProcessInput): Effect.fn.Return<ProcessObservation, RouteNotFound | RequestInvalid | ProcessFailed> {
  switch (method) {
    case HttpMethod.Put: {
      const body = yield* readExecutionBody({ request });
      const schema = Schema.fromJsonString(ProcessStart);
      const start = yield* decodeRequestPart({ schema, value: body });

      if (start.processId !== processId) {
        return yield* new RequestInvalid({ reason: 'process path and request identify different processes' });
      }

      return yield* processes.start(start);
    }
    case HttpMethod.Get: {
      const observed = yield* processes.read({ processId });

      if (Option.isNone(observed)) {
        return yield* notFound;
      }

      return observed.value;
    }
    case HttpMethod.Delete: {
      const observed = yield* processes.stop({ processId });

      if (Option.isNone(observed)) {
        return yield* notFound;
      }

      return observed.value;
    }
    default:
      return yield* notFound;
  }
});
