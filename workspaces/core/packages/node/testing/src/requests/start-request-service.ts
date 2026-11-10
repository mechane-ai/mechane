import { serveRequests } from '@mechane/program';
import type { ServedAnswer, ServedRequest } from '@mechane/program';
import {
  bearerAuthorization,
  ExternalRequestKind,
  ExternalRequestState,
  ExternalRequestStatus,
} from '@mechane/protocol';
import { ExternalRequestId, HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import { Effect, Option, Result, Schema } from 'effect';
import type { Scope } from 'effect';
import { CheckFailed } from '../errors.ts';

type RequestIdInput = { readonly id: ExternalRequestId };
type RequestCreateInput = { readonly kind: ExternalRequestKind };
type PendingRequestInput = RequestIdInput & RequestCreateInput;
type StartRequestServiceInput = { readonly token: string };
type RequestDecisionInput = RequestIdInput & { readonly status: ExternalRequestStatus['status'] };
type StatusAnswerInput = { readonly status: HttpStatusCode; readonly body: unknown };

/** The smoke controls terminal decisions while Mechane uses the service over HTTP. */
export type LocalRequestService = {
  readonly url: URL;
  readonly create: (input: RequestCreateInput) => ExternalRequestId;
  readonly decide: (input: RequestDecisionInput) => void;
  readonly requests: () => ReadonlyArray<ExternalRequestStatus>;
};

const Submission = Schema.fromJsonString(Schema.Struct({ id: ExternalRequestId }));
const REQUEST_COLLECTION_PATH = '/requests';
const ACCESS_COLLECTION_PATH = '/requests/access';

/** A loopback service commits before losing the first submission response; its human decision is an explicit gate. */
export const startRequestService = Effect.fn('startRequestService')(function* ({
  token,
}: StartRequestServiceInput): Effect.fn.Return<LocalRequestService, CheckFailed, Scope.Scope> {
  const requests = new Map<string, ExternalRequestStatus>();
  const submissions = new Map<string, string>();
  const unreadable = new Set<string>();
  const authorization = bearerAuthorization({ token });

  function create({ kind }: RequestCreateInput): ExternalRequestId {
    const id = ExternalRequestId.make(crypto.randomUUID());
    const pending = pendingRequest({ id, kind });

    requests.set(id, pending);

    return id;
  }

  function decide({ id, status }: RequestDecisionInput): void {
    const existing = requests.get(id);
    const known = Option.fromNullishOr(existing);

    if (Option.isSome(known)) {
      requests.set(id, { ...known.value, status });
    }
  }

  function answer({ headers, method, url, body }: ServedRequest): ServedAnswer {
    if (headers.authorization !== authorization) {
      return answerStatus({ status: HttpStatusCode.Unauthorized, body: null });
    }

    if (method === HttpMethod.Post && url.pathname === ACCESS_COLLECTION_PATH) {
      const submitted = Schema.decodeUnknownResult(Submission)(body);

      if (Result.isFailure(submitted)) {
        return answerStatus({ status: HttpStatusCode.BadRequest, body: null });
      }

      const { id } = submitted.success;
      const original = submissions.get(id);
      const previous = Option.fromNullishOr(original);

      if (Option.isSome(previous) && previous.value !== body) {
        return answerStatus({ status: HttpStatusCode.Conflict, body: null });
      }

      if (!requests.has(id)) {
        const pending = pendingRequest({ id, kind: ExternalRequestKind.Access });

        submissions.set(id, body);
        unreadable.add(id);
        requests.set(id, pending);

        return answerStatus({ status: HttpStatusCode.Unavailable, body: null });
      }

      const request = requests.get(id);
      const existing = Option.fromNullishOr(request);

      if (Option.isSome(existing)) {
        const encoded = Schema.encodeSync(ExternalRequestStatus)(existing.value);

        return answerStatus({ status: HttpStatusCode.Ok, body: encoded });
      }
    }

    const id = url.pathname.split('/').at(-1);
    const key = Option.fromNullishOr(id);

    if (Option.isNone(key)) {
      return answerStatus({ status: HttpStatusCode.NotFound, body: null });
    }

    const request = requests.get(key.value);
    const known = Option.fromNullishOr(request);

    if (Option.isSome(known) && method === HttpMethod.Get) {
      const { kind, id: requestId } = known.value;
      const path = requestPath({ kind, id: requestId });

      if (url.pathname === path) {
        if (unreadable.delete(requestId)) {
          return answerStatus({ status: HttpStatusCode.NotFound, body: null });
        }

        const encoded = Schema.encodeSync(ExternalRequestStatus)(known.value);

        return answerStatus({ status: HttpStatusCode.Ok, body: encoded });
      }
    }

    return answerStatus({ status: HttpStatusCode.NotFound, body: null });
  }

  const listening = serveRequests({ answer });

  const origin = yield* Effect.mapError(
    listening,
    ({ reason }) => new CheckFailed({ name: 'request-service fixture', reason }),
  );

  return { url: new URL(REQUEST_COLLECTION_PATH, origin), create, decide, requests: () => [...requests.values()] };
});

function pendingRequest({ id, kind }: PendingRequestInput): ExternalRequestStatus {
  return { id, kind, status: ExternalRequestState.Pending, approval: Option.none(), error: Option.none() };
}

function answerStatus({ status, body }: StatusAnswerInput): ServedAnswer {
  return { status, headers: { [HttpHeader.ContentType]: MediaType.Json }, body: JSON.stringify(body) };
}

function requestPath({ kind, id }: PendingRequestInput): string {
  return `${REQUEST_COLLECTION_PATH}/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`;
}
