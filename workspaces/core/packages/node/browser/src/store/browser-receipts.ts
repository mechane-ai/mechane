import { BROWSER_RESPONSE_MAX_BYTES, BrowserRequest, BrowserResponse, BrowserResult } from '@mechane/sandbox-wire';
import type { BrowserRequestId } from '@mechane/sandbox-wire';
import { Effect, Option, Schema } from 'effect';
import { existsSync } from 'node:fs';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BrowserFailed, BrowserFailureKind } from '../errors.ts';
import { METADATA_SUFFIX, PARTIAL_SUFFIX, REQUESTS_DIRECTORY } from './constants.ts';
import { prepareDirectory } from './prepare-directory.ts';

const BrowserReceiptRecord = Schema.Struct({
  request: BrowserRequest,
  response: Schema.OptionFromNullOr(BrowserResponse),
});

type BrowserReceiptRecord = typeof BrowserReceiptRecord.Type;
const BrowserReceiptJson = Schema.fromJsonString(BrowserReceiptRecord);
const BrowserRequestJson = Schema.fromJsonString(BrowserRequest);
const BrowserResponseJson = Schema.fromJsonString(BrowserResponse);

type ReadBrowserReceiptInput = { readonly scratchDirectory: string; readonly request: BrowserRequest };
type ReadBrowserReceiptRecordInput = { readonly scratchDirectory: string; readonly requestId: BrowserRequestId };

/** Reads the original intent and any saved response; absence means this guest has no journal record. */
export const readBrowserReceiptRecord = Effect.fn('readBrowserReceiptRecord')(function* ({
  scratchDirectory,
  requestId,
}: ReadBrowserReceiptRecordInput): Effect.fn.Return<Option.Option<BrowserReceiptRecord>, BrowserFailed> {
  const filename = join(scratchDirectory, REQUESTS_DIRECTORY, `${requestId}${METADATA_SUFFIX}`);

  if (!existsSync(filename)) {
    return Option.none();
  }

  const serialized = yield* Effect.tryPromise({
    try: () => readFile(filename, 'utf8'),
    catch: (cause) => new BrowserFailed({ kind: BrowserFailureKind.Storage, reason: String(cause) }),
  });

  const receipt = yield* Schema.decodeUnknownEffect(BrowserReceiptJson, { onExcessProperty: 'error' })(serialized).pipe(
    Effect.mapError(
      () =>
        new BrowserFailed({
          kind: BrowserFailureKind.Storage,
          reason: 'browser request receipt is invalid; its outcome is uncertain',
        }),
    ),
  );

  if (receipt.request.requestId !== requestId) {
    return yield* new BrowserFailed({
      kind: BrowserFailureKind.Storage,
      reason: 'browser receipt request does not match its journal identity',
    });
  }

  if (Option.isSome(receipt.response) && receipt.response.value.requestId !== requestId) {
    return yield* new BrowserFailed({
      kind: BrowserFailureKind.Storage,
      reason: 'browser receipt response does not match its journal identity',
    });
  }

  return Option.some(receipt);
});

/** Replays a matching completed receipt; an intent without a result is explicitly uncertain. */
export const readBrowserReceipt = Effect.fn('readBrowserReceipt')(function* ({
  scratchDirectory,
  request,
}: ReadBrowserReceiptInput): Effect.fn.Return<Option.Option<BrowserResponse>, BrowserFailed> {
  const saved = yield* readBrowserReceiptRecord({ scratchDirectory, requestId: request.requestId });

  if (Option.isNone(saved)) {
    return Option.none();
  }

  const receipt = saved.value;

  const encode = Schema.encodeSync(BrowserRequestJson);

  if (encode(receipt.request) !== encode(request)) {
    return yield* new BrowserFailed({
      kind: BrowserFailureKind.Conflict,
      reason: 'browser request identifier was already used for another action',
    });
  }

  if (Option.isSome(receipt.response)) {
    return receipt.response;
  }

  const result = BrowserResult.cases.Uncertain.make({
    reason: 'browser action began before its receipt was saved; it will not be replayed',
  });

  return Option.some({ requestId: request.requestId, result });
});

type WriteBrowserReceiptInput = ReadBrowserReceiptInput & {
  /** Absent while only the durable pre-action intent has been written. */
  readonly response: Option.Option<BrowserResponse>;
};

/** Writes intent exclusively before an action and atomically replaces it with the bounded terminal result. */
export const writeBrowserReceipt = Effect.fn('writeBrowserReceipt')(function* ({
  scratchDirectory,
  request,
  response,
}: WriteBrowserReceiptInput): Effect.fn.Return<void, BrowserFailed> {
  const directory = join(scratchDirectory, REQUESTS_DIRECTORY);
  const filename = join(directory, `${request.requestId}${METADATA_SUFFIX}`);

  if (Option.isSome(response)) {
    const serialized = Schema.encodeSync(BrowserResponseJson)(response.value);

    if (Buffer.byteLength(serialized, 'utf8') > BROWSER_RESPONSE_MAX_BYTES) {
      return yield* new BrowserFailed({
        kind: BrowserFailureKind.Capacity,
        reason: 'browser response exceeds its total encoded byte limit',
      });
    }
  }

  const serialized = Schema.encodeSync(BrowserReceiptJson)({ request, response });

  yield* prepareDirectory({ directory });

  if (Option.isNone(response)) {
    yield* Effect.tryPromise({
      try: () => writeFile(filename, serialized, { mode: 0o600, flag: 'wx' }),
      catch: (cause) => new BrowserFailed({ kind: BrowserFailureKind.Storage, reason: String(cause) }),
    });

    return;
  }

  const temporary = `${filename}${PARTIAL_SUFFIX}`;

  yield* Effect.tryPromise({
    try: () => writeFile(temporary, serialized, { mode: 0o600 }),
    catch: (cause) => new BrowserFailed({ kind: BrowserFailureKind.Storage, reason: String(cause) }),
  });
  yield* Effect.tryPromise({
    try: () => rename(temporary, filename),
    catch: (cause) => new BrowserFailed({ kind: BrowserFailureKind.Storage, reason: String(cause) }),
  });
});
