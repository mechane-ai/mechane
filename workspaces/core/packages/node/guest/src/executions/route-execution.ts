import { decodeRequestPart } from '@mechane/protocol';
import type { RequestInvalid, RouteNotFound } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import {
  ExecutionId,
  ExecutionObservation,
  ExecutionReceipt,
  ExecutionRequest,
  ExecutionWait,
} from '@mechane/sandbox-wire';
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

const EXECUTION_METHODS: ReadonlySet<string> = new Set([HttpMethod.Get, HttpMethod.Put]);

/** PUT starts or rejoins a command; GET observes an existing command without resubmitting it. */
export const routeExecution = Effect.fn('routeExecution')(function* ({
  request,
  url,
  method,
  rest,
  ledger,
  notFound,
}: RouteExecutionInput): Effect.fn.Return<ServedAnswer, RouteNotFound | RequestInvalid> {
  if (!EXECUTION_METHODS.has(method) || rest.length !== 1) {
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
  const query = Record.fromEntries(url.searchParams);
  const { wait } = yield* decodeRequestPart({ schema: ExecutionWait, value: query });

  const headers = { [HttpHeader.ContentType]: MediaType.Json };

  if (request.method === HttpMethod.Get) {
    const observation = yield* ledger.observe({ executionId, wait });
    const body = Schema.encodeSync(Schema.fromJsonString(ExecutionObservation))(observation);

    return { status: HttpStatusCode.Ok, headers, body };
  }

  const receipt = yield* submitExecution({ request, executionId, wait, ledger });

  // The ledger built the receipt to its schema's type, so encoding it cannot fail.
  const text = Schema.encodeSync(Schema.fromJsonString(ExecutionReceipt))(receipt);

  return { status: HttpStatusCode.Ok, headers, body: text };
});

type SubmitExecutionInput = Pick<AnswerExecutionInput, 'request' | 'ledger'> & {
  readonly executionId: ExecutionId;
  readonly wait: (typeof ExecutionWait.Type)['wait'];
};

const submitExecution = Effect.fn('submitExecution')(function* ({
  request,
  executionId,
  wait,
  ledger,
}: SubmitExecutionInput): Effect.fn.Return<ExecutionReceipt, RequestInvalid> {
  const body = yield* readExecutionBody({ request });
  const schema = Schema.fromJsonString(ExecutionRequest);
  const execution = yield* decodeRequestPart({ schema, value: body });

  return yield* ledger.answer({ executionId, request: execution, wait });
});
