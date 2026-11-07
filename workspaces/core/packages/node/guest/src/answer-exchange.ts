import type { BrowserFailed, BrowserRuntime } from '@mechane/browser';
import type { RequestInvalid, RouteNotFound } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode, MediaType } from '@mechane/records';
import { GuestSegment } from '@mechane/sandbox-wire';
import { Effect } from 'effect';
import type { IncomingMessage } from 'node:http';
import { answerCapabilities } from './answer-capabilities.ts';
import { answerHealth } from './answer-health.ts';
import { routeBrowser } from './browser/route-browser.ts';
import type { WorkspaceFailed } from './errors.ts';
import { routeExecution } from './executions/route-execution.ts';
import { guestRequestRoute } from './guest-request-route.ts';
import type { ProcessFailed } from './processes/process-failed.ts';
import { routeProcess } from './processes/route-process.ts';
import type { ProcessLedger } from './processes/types.ts';
import { respond } from './respond.ts';
import type { Exchange, ExecutionLedger, GuestSettings, ServedAnswer, WorkspaceJournal } from './types.ts';
import { routeWorkspace } from './workspace/route-workspace.ts';

/** The bare 404 of a request for another machine, which tells its caller it reached another machine's guest. */
const NOT_FOUND: Readonly<ServedAnswer> = { status: HttpStatusCode.NotFound, headers: {}, body: '' };

/** The headers of a 400, whose body says what did not decode. */
const REFUSAL_HEADERS = { [HttpHeader.ContentType]: MediaType.PlainText } as const;

type AnswerExchangeInput = {
  readonly exchange: Exchange;
  readonly settings: GuestSettings;
  readonly ledger: ExecutionLedger;
  readonly workspace: WorkspaceJournal;
  readonly processes: ProcessLedger;
  readonly browser: BrowserRuntime;
};

type RouteRequestInput = {
  readonly request: IncomingMessage;
  readonly settings: GuestSettings;
  readonly ledger: ExecutionLedger;
  readonly workspace: WorkspaceJournal;
  readonly processes: ProcessLedger;
  readonly browser: BrowserRuntime;
};

/**
 * Answers one request: the machine's health, or an execution's receipt once it settles or its wait passes. A request
 * for another machine gets a bare 404, and a malformed request gets a 400 with what did not decode.
 */
export const answerExchange = Effect.fn('answerExchange')(function* ({
  exchange,
  settings,
  ledger,
  workspace,
  processes,
  browser,
}: AnswerExchangeInput): Effect.fn.Return<void> {
  const answer = yield* routeRequest({
    request: exchange.request,
    settings,
    ledger,
    workspace,
    processes,
    browser,
  }).pipe(
    Effect.catchTags({
      RouteNotFound: () => Effect.succeed(NOT_FOUND),
      RequestInvalid: ({ reason }) =>
        Effect.succeed({ status: HttpStatusCode.BadRequest, headers: REFUSAL_HEADERS, body: reason }),
      WorkspaceFailed: ({ reason }) =>
        Effect.succeed({ status: HttpStatusCode.Unavailable, headers: REFUSAL_HEADERS, body: reason }),
      ProcessFailed: ({ reason }) =>
        Effect.succeed({ status: HttpStatusCode.Unavailable, headers: REFUSAL_HEADERS, body: reason }),
      BrowserFailed: ({ reason }) =>
        Effect.succeed({ status: HttpStatusCode.Unavailable, headers: REFUSAL_HEADERS, body: reason }),
    }),
  );

  respond({ response: exchange.response, answer });
});

/** The answer of the route the request's method and path name below the machine's own path. */
const routeRequest = Effect.fn('routeRequest')(function* ({
  request,
  settings,
  ledger,
  workspace,
  processes,
  browser,
}: RouteRequestInput): Effect.fn.Return<
  ServedAnswer,
  RouteNotFound | RequestInvalid | WorkspaceFailed | ProcessFailed | BrowserFailed
> {
  const { method, url, resource, rest, notFound } = yield* guestRequestRoute({
    request,
    machineId: settings.machineId,
  });

  switch (resource) {
    case GuestSegment.Health:
      return yield* answerHealth({ method, rest, notFound });
    case GuestSegment.Capabilities:
      return yield* answerCapabilities({ method, rest, notFound });
    case GuestSegment.Executions:
      return yield* routeExecution({ request, url, method, rest, ledger, notFound });
    case GuestSegment.Processes:
      return yield* routeProcess({ request, method, rest, processes, notFound });
    case GuestSegment.Browser:
      return yield* routeBrowser({ request, method, url, rest, browser, ledger, notFound });
    case GuestSegment.Workspace:
      return yield* routeWorkspace({ request, method, rest, workspace, notFound });
    default:
      return yield* notFound;
  }
});
