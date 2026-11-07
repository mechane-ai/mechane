import { RecordText } from '@mechane/records';
import { Effect, Schema } from 'effect';
import type { Scope } from 'effect';
import { createServer } from 'node:http';
import type { RequestListener } from 'node:http';
import { Readable } from 'node:stream';
import type { LoopbackFailed } from '../errors.ts';
import { loopbackUrl } from './loopback-url.ts';
import { serveOnLoopback } from './serve-on-loopback.ts';
import type { ServedAnswer, ServedRequest } from './types.ts';

type ServeRequestsInput = { readonly answer: (request: ServedRequest) => ServedAnswer };

/** The origin that completes a request's path into a URL; a local service reads only the path and the query. */
const REQUEST_BASE = 'http://local.invalid';

/** The parts of a Node request a local service reads; a server's requests always carry both. */
const RequestLine = Schema.Struct({ method: RecordText, url: RecordText });

type RequestLine = typeof RequestLine.Type;

/**
 * Serves a local HTTP service on a loopback port until the scope closes, and answers with its origin. Each request gets
 * its answer once its body has arrived, and a streamed body goes out part by part.
 */
export const serveRequests = Effect.fn('serveRequests')(function* ({
  answer,
}: ServeRequestsInput): Effect.fn.Return<URL, LoopbackFailed, Scope.Scope> {
  const serve: RequestListener = (request, response) => {
    const chunks: Array<string> = [];

    const respond: () => void = () => {
      const { method, url } = Schema.decodeUnknownSync(RequestLine)(request);
      const requestUrl = new URL(url, REQUEST_BASE);
      const body = chunks.join('');

      const served = answer({ method, url: requestUrl, headers: request.headers, body });

      const stream = Readable.from(served.body);
      const output = response.writeHead(served.status, served.headers);

      stream.pipe(output);
    };

    request.setEncoding('utf8');
    request.on('data', (chunk: string) => chunks.push(chunk));
    request.on('end', respond);
  };

  const server = createServer(serve);
  const port = yield* serveOnLoopback({ server });
  const origin = loopbackUrl({ port });

  return new URL(origin);
});
