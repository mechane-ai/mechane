import { catalog, RequestInvalid } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode, SHA256_PATTERN } from '@mechane/records';
import { admitNotification } from '@mechane/runtime';
import type { MechActorResolver, NotificationProducer } from '@mechane/runtime';
import { Redacted, Schema } from 'effect';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readTextBody } from '../http/body.ts';
import { respondFailure } from '../http/failure.ts';
import { findRoute } from '../http/route.ts';
import { NOTIFICATION_BODY_MAX_BYTES } from './constants.ts';

const SIGNATURE_MAX_AGE_SECONDS = 300;
const MILLISECONDS_PER_SECOND = 1000;

const SIGNATURE_HEADERS: ReadonlyArray<string> = [
  HttpHeader.NotificationProducer,
  HttpHeader.NotificationTimestamp,
  HttpHeader.NotificationSignature,
];

const RESPONSE_HEADERS: Readonly<Record<string, string>> = { [HttpHeader.CacheControl]: 'no-store' };

type ProducerHandlerInput = {
  readonly actors: MechActorResolver;
  readonly producers: ReadonlyArray<NotificationProducer>;
};

function validSignature({
  producer,
  timestamp,
  signature,
  pathname,
  rawBody,
}: {
  readonly producer: NotificationProducer;
  readonly timestamp: string;
  readonly signature: string;
  readonly pathname: string;
  readonly rawBody: string;
}): boolean {
  const seconds = Number(timestamp);

  if (!/^\d+$/u.test(timestamp) || !Number.isSafeInteger(seconds) || !SHA256_PATTERN.test(signature)) {
    return false;
  }

  if (Math.abs(Date.now() / MILLISECONDS_PER_SECOND - seconds) > SIGNATURE_MAX_AGE_SECONDS) {
    return false;
  }

  const expected = createHmac('sha256', Redacted.value(producer.secret))
    .update(`${timestamp}.${pathname}.${rawBody}`)
    .digest('hex');

  const encoder = new TextEncoder();

  return timingSafeEqual(encoder.encode(expected), encoder.encode(signature));
}

export function createNotificationProducerHandler({ actors, producers }: ProducerHandlerInput) {
  return async function notificationProducer(request: Request): Promise<Response | null> {
    if (!SIGNATURE_HEADERS.some((header) => request.headers.has(header))) {
      return null;
    }

    try {
      const url = new URL(request.url);
      const route = findRoute({ method: request.method, pathname: url.pathname });
      const producer = producers.find((entry) => entry.id === request.headers.get(HttpHeader.NotificationProducer));

      if (route?.name !== 'sendNotification' || producer === undefined || url.search !== '') {
        return new Response(null, { status: HttpStatusCode.Unauthorized, headers: RESPONSE_HEADERS });
      }

      const rawBody = await readTextBody(request, NOTIFICATION_BODY_MAX_BYTES);

      const verified = validSignature({
        producer,
        rawBody,
        pathname: url.pathname,
        timestamp: request.headers.get(HttpHeader.NotificationTimestamp) ?? '',
        signature: request.headers.get(HttpHeader.NotificationSignature) ?? '',
      });

      if (!verified) {
        return new Response(null, { status: HttpStatusCode.Unauthorized, headers: RESPONSE_HEADERS });
      }

      const params = Schema.decodeUnknownResult(catalog.sendNotification.params, { onExcessProperty: 'error' })(
        route.params,
      );

      const body = Schema.decodeUnknownResult(Schema.fromJsonString(catalog.sendNotification.body), {
        onExcessProperty: 'error',
      })(rawBody);

      if (params._tag === 'Failure' || body._tag === 'Failure') {
        throw new RequestInvalid({ reason: 'The notification fields are invalid' });
      }

      const recipient = params.success;

      const allowed = producer.recipients.some(
        (scope) => scope.workspaceId === recipient.workspaceId && scope.mechId === recipient.mechId,
      );

      if (!allowed) {
        return new Response(null, { status: HttpStatusCode.Forbidden, headers: RESPONSE_HEADERS });
      }

      const receipt = await admitNotification({
        actors,
        input: { ...recipient, ...body.success },
        producer: { kind: 'producer', id: producer.id },
      });

      const output = Schema.decodeUnknownSync(catalog.sendNotification.output)(receipt);

      return Response.json(Schema.encodeSync(catalog.sendNotification.output)(output), { headers: RESPONSE_HEADERS });
    } catch (failure) {
      return respondFailure({ failure, request });
    }
  };
}
