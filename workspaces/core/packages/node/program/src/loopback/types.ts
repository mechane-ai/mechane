import type { HttpStatusCode } from '@mechane/records';
import type { IncomingHttpHeaders } from 'node:http';

/** A local HTTP response may write its whole body at once or stream parts as they arrive. */
export type ServedAnswer = {
  readonly status: HttpStatusCode;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | AsyncIterable<string>;
};

/** A local request reaches its handler after the complete body is read; header names are lowercase. */
export type ServedRequest = {
  readonly method: string;
  readonly url: URL;
  readonly headers: IncomingHttpHeaders;
  readonly body: string;
};
