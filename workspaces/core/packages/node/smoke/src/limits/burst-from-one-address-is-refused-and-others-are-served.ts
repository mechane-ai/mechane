import { catalog, ErrorBody, ErrorFamily, KeyPurpose } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import type { Stack } from '@mechane/stack';
import { BrowserStep, check, sentPage } from '@mechane/testing';
import type { Page, ScenarioFailure, ScenarioInput } from '@mechane/testing';
import { Array, Effect, Option, Result, Schema } from 'effect';

/**
 * The addresses the scenario's requests come from, as Cloudflare's edge would name them: two of the documentation
 * range, so no real client shares either's limiter.
 */
const PeerAddress = { Burst: '203.0.113.7', Other: '203.0.113.8' } as const;

/** How many device approvals the burst starts from one address: one past the ten a window of starts allows. */
const BURST_STARTS = 11;

/** The key name of each device approval the burst starts. */
const BURST_KEY_NAME = 'burst';

/** The stack, and the address a start comes from. */
type StartFromInput = { readonly stack: Stack; readonly address: string };

/**
 * Starts eleven device approvals from one address, as Cloudflare's edge names it, and one from another. The window
 * serves ten, the eleventh gets a 429 whose wait and family the CLI reads, and the other address, whose limiter is its
 * own, is served. A restart forgets what a limiter holds only in memory, as an eviction would, and the burst's address
 * is still refused after it.
 */
export const burstFromOneAddressIsRefusedAndOthersAreServed = Effect.fn(
  'burstFromOneAddressIsRefusedAndOthersAreServed',
)(function* ({ stack, guarantee }: ScenarioInput): Effect.fn.Return<void, ScenarioFailure> {
  const starts = Array.makeBy(BURST_STARTS, () => startFrom({ stack, address: PeerAddress.Burst }));
  const burst = yield* Effect.all(starts, { concurrency: 1 });
  const other = yield* startFrom({ stack, address: PeerAddress.Other });

  yield* stack.restart({ variables: {} });

  const restarted = yield* startFrom({ stack, address: PeerAddress.Burst });
  const refused = Array.lastNonEmpty(burst);
  const body = Result.getSuccess(Schema.decodeUnknownResult(Schema.fromJsonString(ErrorBody))(refused.text));
  const family = Option.map(body, ({ error }) => error.family);
  const retryAfter = Option.fromNullishOr(refused.headers.get(HttpHeader.RetryAfter));
  const retryAfterSeconds = Number(Option.getOrElse(retryAfter, () => ''));

  yield* check({
    name: guarantee,
    conditions: [
      Array.dropRight(burst, 1).every(({ status }) => status === HttpStatusCode.Ok),
      refused.status === HttpStatusCode.TooManyRequests,
      Number.isInteger(retryAfterSeconds),
      retryAfterSeconds > 0,
      Option.contains(family, ErrorFamily.RateLimited),
      other.status === HttpStatusCode.Ok,
      restarted.status === HttpStatusCode.TooManyRequests,
    ],
    detail: `the burst answered ${burst.map(({ status }) => status).join(', ')}, the last with retry-after ${Option.getOrElse(retryAfter, () => 'none')} and family ${Option.getOrElse(family, () => 'none')}; the other address answered ${other.status}, and the burst's after a restart ${restarted.status}`,
  });
});

/** Starts one device approval as a request from `address` that Cloudflare's edge passed on. */
const startFrom = Effect.fn('startFrom')(function* ({
  stack,
  address,
}: StartFromInput): Effect.fn.Return<Page, ScenarioFailure> {
  const operation = catalog.startDeviceApproval;
  const body = Schema.encodeSync(operation.body)({ purpose: KeyPurpose.Login, name: BURST_KEY_NAME });

  const request = new Request(new URL(operation.path, stack.origin), {
    method: HttpMethod.Post,
    headers: { [HttpHeader.ContentType]: MediaType.Json, [HttpHeader.ConnectingIp]: address },
    body: JSON.stringify(body),
  });

  return yield* sentPage({ step: BrowserStep.StartApproval, request });
});
