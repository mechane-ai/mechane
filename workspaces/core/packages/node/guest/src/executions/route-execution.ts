import { decodeRequestPart } from '@mechane/protocol';
import type { RequestInvalid, RouteNotFound } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import { ExecutionId, ExecutionReceipt, ExecutionRequest, ExecutionWait } from '@mechane/sandbox-wire';
import { Effect, Record, Schema } from 'effect';
import type { IncomingMessage } from 'node:http';
import type { ExecutionLedger, ServedAnswer } from '../types.ts';
import { readExecutionBody } from './read-execution-body.ts';

type RouteExecutionInput = {
  readonly request: IncomingMessage;
  readonly url: URL;
  readonly method: string;
  readonly rest: ReadonlyArray<string>;
  readonly ledger: ExecutionLedger;
  readonly notFound: RouteNotFound;
};

type AnswerExecutionInput = {
  readonly request: IncomingMessage;
  readonly url: URL;
  /** The path's last segment, which the execution id decodes from. */
  readonly idSegment: unknown;
  readonly ledger: ExecutionLedger;
};

/** Answers a `PUT` of one execution, whose id is the path's last segment. */
export const routeExecution = Effect.fn('routeExecution')(function* ({
  request,
  url,
  method,
  rest,
  ledger,
  notFound,
}: RouteExecutionInput): Effect.fn.Return<ServedAnswer, RouteNotFound | RequestInvalid> {
  if (method !== HttpMethod.Put || rest.length !== 1) {
    return yield* notFound;
  }

  return yield* answerExecution({ request, url, idSegment: rest[0], ledger });
});

/** Starts or joins the execution, and answers its receipt; every part refuses a field its schema does not declare. */
const answerExecution = Effect.fn('answerExecution')(function* ({
  request,
  url,
  idSegment,
  ledger,
}: AnswerExecutionInput): Effect.fn.Return<ServedAnswer, RequestInvalid> {
  const executionId = yield* decodeRequestPart({ schema: ExecutionId, value: idSegment });
  const { wait } = yield* decodeRequestPart({ schema: ExecutionWait, value: Record.fromEntries(url.searchParams) });
  const body = yield* readExecutionBody({ request });
  const execution = yield* decodeRequestPart({ schema: Schema.fromJsonString(ExecutionRequest), value: body });
  const receipt = yield* ledger.answer({ executionId, request: execution, wait });
  // The ledger built the receipt to its schema's type, so encoding it cannot fail.
  const text = Schema.encodeSync(Schema.fromJsonString(ExecutionReceipt))(receipt);

  return { status: HttpStatusCode.Ok, headers: { [HttpHeader.ContentType]: MediaType.Json }, body: text };
});
