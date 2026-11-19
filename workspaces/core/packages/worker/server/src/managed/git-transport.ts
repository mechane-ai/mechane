import { HttpHeader, HttpStatusCode, MediaType } from '@mechane/records';
import type { GitOperation } from '@mechane/sandbox-wire';
import { Redacted, Schema } from 'effect';
import { authorizeGitPush } from './git-push.ts';
import type { openManagedGitTransfer } from './git-transfer.ts';

type Transfer = Awaited<ReturnType<typeof openManagedGitTransfer>>;

type GitTransport = {
  readonly request: Request;
  readonly url: URL;
  readonly operation: GitOperation;
  readonly credential: Redacted.Redacted | null;
  readonly allowedRefs: ReadonlyArray<string>;
  readonly maxBytes: number;
  readonly transfer: Transfer;
};

export function gitErrorResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { [HttpHeader.CacheControl]: 'no-store', [HttpHeader.ContentType]: MediaType.PlainText },
  });
}

function upstreamHeaders({ request, operation, credential }: GitTransport): Headers {
  const headers = new Headers();

  if (credential !== null) {
    const secret = Redacted.value(credential);
    const basic = Schema.encodeSync(Schema.StringFromBase64)(`x-access-token:${secret}`);

    headers.set(HttpHeader.Authorization, `Basic ${basic}`);
  }

  if (!operation.isAdvertisement) {
    headers.set(HttpHeader.ContentType, `application/x-${operation.service}-request`);
  }

  if (request.headers.get('git-protocol') === 'version=2' && operation.service === 'git-upload-pack') {
    headers.set('git-protocol', 'version=2');
  }

  return headers;
}

async function upstreamBody({ request, operation, allowedRefs, maxBytes, transfer }: GitTransport) {
  if (request.body === null) {
    return null;
  }

  const upload = transfer.stream(request.body, 'upload');

  if (operation.service === 'git-receive-pack') {
    return await authorizeGitPush({ body: upload, allowedRefs, maxBytes });
  }

  return upload;
}

function resultType(operation: GitOperation): string {
  if (operation.isAdvertisement) {
    return `application/x-${operation.service}-advertisement`;
  }

  return `application/x-${operation.service}-result`;
}

export async function forwardGit(input: GitTransport): Promise<Response> {
  const { request, operation, transfer, url } = input;

  try {
    const headers = upstreamHeaders(input);
    const body = await upstreamBody(input);

    const response = await fetch(url, {
      method: request.method,
      signal: request.signal,
      headers,
      body,
      redirect: 'manual',
    });

    const expected = resultType(operation);

    if (!response.ok || response.body === null || response.headers.get(HttpHeader.ContentType) !== expected) {
      await response.body?.cancel();
      await transfer.close();

      if (response.status >= HttpStatusCode.BadRequest && response.status < HttpStatusCode.InternalServerError) {
        return gitErrorResponse(response.status, 'Git host declined the request');
      }

      return gitErrorResponse(HttpStatusCode.BadGateway, 'Git host did not return the requested Git service');
    }

    const result = transfer.stream(response.body, 'download');

    return new Response(result, {
      headers: { [HttpHeader.ContentType]: expected, [HttpHeader.CacheControl]: 'no-store' },
    });
  } catch (failure) {
    await transfer.close();

    throw failure;
  }
}
