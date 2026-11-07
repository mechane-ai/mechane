import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import { acceptNexusRequestEvent, RequestEventRejectedError } from '@mechane/runtime';
import { readTextBody } from '../http/body.ts';
import { respondFailure } from '../http/failure.ts';

const EVENT_BODY_MAX_BYTES = 32_768;
const EVENTS_PATH = '/api/nexus/request-events';

export async function nexusRequestEvents(request: Request): Promise<Response | null> {
  const url = new URL(request.url);

  if (url.pathname !== EVENTS_PATH) {
    return null;
  }

  if (request.method !== HttpMethod.Post) {
    return new Response(null, { status: HttpStatusCode.MethodNotAllowed, headers: { allow: HttpMethod.Post } });
  }

  try {
    const rawBody = await readTextBody(request, EVENT_BODY_MAX_BYTES);
    const timestamp = request.headers.get(HttpHeader.NexusEventTimestamp) ?? '';
    const signature = request.headers.get(HttpHeader.NexusEventSignature) ?? '';
    const result = await acceptNexusRequestEvent({ rawBody, timestamp, signature });

    return Response.json(result, { headers: { [HttpHeader.CacheControl]: 'no-store' } });
  } catch (failure) {
    if (failure instanceof RequestEventRejectedError) {
      return Response.json(
        { error: 'The request event was not accepted.' },
        { status: failure.status, headers: { [HttpHeader.CacheControl]: 'no-store' } },
      );
    }

    return respondFailure({ failure, request });
  }
}
