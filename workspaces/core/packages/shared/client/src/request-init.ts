import { bearerAuthorization } from '@mechane/protocol';
import type { Access, OperationMethod } from '@mechane/protocol';
import { HttpHeader, HttpMethod, MediaType } from '@mechane/records';
import { Redacted } from 'effect';
import type { AccessCredential } from './types.ts';

/** The method, body, credential and program of a request. */
type RequestInitInput = {
  readonly method: OperationMethod;
  readonly body: unknown;
  /** The key its access sends, none for a public operation. */
  readonly credential: AccessCredential[Access];
  readonly userAgent: string;
};

/** The method, headers and body of a request; a mutation carries its encoded body as JSON. */
export function requestInit({ method, body, credential, userAgent }: RequestInitInput): RequestInit {
  const headers = new Headers({ [HttpHeader.Accept]: MediaType.Json, [HttpHeader.UserAgent]: userAgent });

  if (Redacted.isRedacted(credential)) {
    headers.set(HttpHeader.Authorization, bearerAuthorization({ token: Redacted.value(credential) }));
  }

  switch (method) {
    case HttpMethod.Get:
      return { method, headers };
    case HttpMethod.Post:
    case HttpMethod.Put:
    case HttpMethod.Delete:
      return {
        method,
        headers: new Headers([...headers, [HttpHeader.ContentType, MediaType.Json]]),
        body: JSON.stringify(body),
      };
  }
}
