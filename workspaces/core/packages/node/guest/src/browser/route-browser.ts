import type { BrowserFailed, BrowserRuntime } from '@mechane/browser';
import { decodeRequestPart } from '@mechane/protocol';
import type { RequestInvalid, RouteNotFound } from '@mechane/protocol';
import { EvidenceArtifactId, HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import {
  BrowserArtifactPart,
  BrowserReceipt,
  BrowserRequest,
  BrowserRequestId,
  BrowserResponse,
  GuestSegment,
} from '@mechane/sandbox-wire';
import { Effect, Schema } from 'effect';
import type { Scope } from 'effect';
import type { IncomingMessage } from 'node:http';
import { readExecutionBody } from '../executions/read-execution-body.ts';
import type { ExecutionLedger, ServedAnswer } from '../types.ts';

const HEADERS = { [HttpHeader.ContentType]: MediaType.Json } as const;
const BROWSER_RESOURCE_SEGMENTS = 2;
const integerOffset = Schema.isInt();
const positiveOffset = Schema.isGreaterThanOrEqualTo(0);
const ArtifactOffset = Schema.NumberFromString.check(integerOffset, positiveOffset);

type RouteBrowserInput = {
  readonly request: IncomingMessage;
  readonly method: string;
  readonly url: URL;
  readonly rest: ReadonlyArray<string>;
  readonly browser: BrowserRuntime;
  readonly ledger: ExecutionLedger;
  readonly notFound: RouteNotFound;
};

/** Admits actions through the command gate; receipt and capture reads never dispatch browser work. */
export const routeBrowser = Effect.fn('routeBrowser')(function* ({
  request,
  method,
  url,
  rest,
  browser,
  ledger,
  notFound,
}: RouteBrowserInput): Effect.fn.Return<ServedAnswer, RouteNotFound | RequestInvalid | BrowserFailed, Scope.Scope> {
  if (rest.length === 0 && method === HttpMethod.Post) {
    const text = yield* readExecutionBody({ request });
    const schema = Schema.fromJsonString(BrowserRequest);
    const decoded = yield* decodeRequestPart({ schema, value: text });

    if (!ledger.admitProcess()) {
      return { status: HttpStatusCode.NoContent, headers: {}, body: '' };
    }

    yield* Effect.acquireRelease(Effect.void, () => Effect.sync(ledger.finishProcessStart));

    const response = yield* browser.perform({ request: decoded });
    const responseSchema = Schema.fromJsonString(BrowserResponse);
    const body = Schema.encodeSync(responseSchema)(response);

    return { status: HttpStatusCode.Ok, headers: HEADERS, body };
  }

  if (rest.length === BROWSER_RESOURCE_SEGMENTS && rest[0] === GuestSegment.Requests && method === HttpMethod.Get) {
    const requestId = yield* decodeRequestPart({ schema: BrowserRequestId, value: rest[1] });
    const receipt = yield* browser.readReceipt({ requestId });
    const schema = Schema.fromJsonString(BrowserReceipt);
    const body = Schema.encodeSync(schema)(receipt);

    return { status: HttpStatusCode.Ok, headers: HEADERS, body };
  }

  if (rest.length === BROWSER_RESOURCE_SEGMENTS && rest[0] === GuestSegment.Artifacts && method === HttpMethod.Get) {
    const artifactId = yield* decodeRequestPart({ schema: EvidenceArtifactId, value: rest[1] });
    const suppliedOffset = url.searchParams.get('offset');
    const offset = yield* decodeRequestPart({ schema: ArtifactOffset, value: suppliedOffset });
    const part = yield* browser.readArtifactPart({ artifactId, offset });
    const schema = Schema.fromJsonString(BrowserArtifactPart);
    const body = Schema.encodeSync(schema)(part);

    return { status: HttpStatusCode.Ok, headers: HEADERS, body };
  }

  return yield* notFound;
}, Effect.scoped);
