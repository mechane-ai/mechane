import { decodeRequestPart, EVIDENCE_ARTIFACT_MAX_BYTES, RequestInvalid } from '@mechane/protocol';
import type { RouteNotFound } from '@mechane/protocol';
import { Bytes, HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import { EvidenceExportFile, EvidenceExportMetadata } from '@mechane/sandbox-wire';
import { Effect, Record, Schema } from 'effect';
import type { Scope } from 'effect';
import type { IncomingMessage } from 'node:http';
import { admitGuestMutation } from '../admit-guest-mutation.ts';
import { readGuestBody } from '../read-guest-body.ts';
import type { ExecutionLedger, ServedAnswer } from '../types.ts';
import { writeEvidenceFile } from './write-evidence-file.ts';

const ExportParameters = Schema.Struct({
  ...EvidenceExportMetadata.fields,
  sizeBytes: Schema.NumberFromString.check(
    Schema.isInt(),
    Schema.isGreaterThan(0),
    Schema.isLessThanOrEqualTo(EVIDENCE_ARTIFACT_MAX_BYTES),
  ),
});

type RouteEvidenceInput = {
  readonly request: IncomingMessage;
  readonly method: string;
  readonly url: URL;
  readonly rest: ReadonlyArray<string>;
  readonly ledger: ExecutionLedger;
  readonly home: string;
  readonly notFound: RouteNotFound;
};

/** The command gate prevents copying into a home while its checkpoint is frozen. */
export const routeEvidence = Effect.fn('routeEvidence')(function* ({
  request,
  method,
  url,
  rest,
  ledger,
  home,
  notFound,
}: RouteEvidenceInput): Effect.fn.Return<ServedAnswer, RouteNotFound | RequestInvalid, Scope.Scope> {
  if (method !== HttpMethod.Post || rest.length !== 1) {
    return yield* notFound;
  }

  const parameters = Record.fromEntries(url.searchParams);
  const input = { ...parameters, artifactId: rest[0] };
  const decoded = yield* decodeRequestPart({ schema: ExportParameters, value: input });
  const metadata = yield* decodeRequestPart({ schema: EvidenceExportMetadata, value: decoded });

  const isAdmitted = yield* admitGuestMutation({ ledger });

  if (!isAdmitted) {
    return { status: HttpStatusCode.NoContent, headers: {}, body: '' };
  }

  const maximumBytes = Bytes.make(metadata.sizeBytes);

  const bytes = yield* readGuestBody({
    request,
    maximumBytes,
    onLimit: () => new RequestInvalid({ reason: 'evidence export exceeds its saved byte count' }),
    onError: () => new RequestInvalid({ reason: 'evidence export transport was interrupted' }),
  });

  const file = yield* writeEvidenceFile({ home, metadata, bytes });

  const schema = Schema.fromJsonString(EvidenceExportFile);
  const body = Schema.encodeSync(schema)(file);
  const headers = { [HttpHeader.ContentType]: MediaType.Json };

  return { status: HttpStatusCode.Ok, headers, body };
}, Effect.scoped);
