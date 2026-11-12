import { writeResult } from '@mechane/program';
import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import { guestHealthPath, GuestListening, GuestStatus, StartupPhase } from '@mechane/sandbox-wire';
import { Effect, Option, Queue, Schema } from 'effect';
import type { Scope } from 'effect';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { closeServer } from './close-server.ts';
import { GuestUnreachable } from './errors.ts';
import { respond } from './respond.ts';
import type { Exchange, GuestSettings } from './types.ts';

type GuestListenerInput = {
  readonly settings: GuestSettings;
  readonly exchanges: Queue.Queue<Exchange>;
  readonly startup: () => GuestStatus;
};

const BoundAddress = Schema.Struct({ port: Schema.Int });
const ListeningLine = Schema.fromJsonString(GuestListening);
const StartupJson = Schema.fromJsonString(GuestStatus);

/** The identity-bound status endpoint remains available while tools are prepared; commands wait for readiness. */
export const listenToGuest = Effect.fn('listenToGuest')(function* ({
  settings,
  exchanges,
  startup,
}: GuestListenerInput): Effect.fn.Return<void, GuestUnreachable, Scope.Scope> {
  const healthPath = guestHealthPath({ machineId: settings.machineId });

  function receive(request: IncomingMessage, response: ServerResponse): void {
    const progress = startup();

    if (request.method === HttpMethod.Get && request.url === healthPath) {
      const body = Schema.encodeSync(StartupJson)(progress);

      request.resume();
      respond({
        response,
        answer: { status: HttpStatusCode.Ok, headers: { [HttpHeader.ContentType]: MediaType.Json }, body },
      });

      return;
    }

    if (progress.bootstrap.phase !== StartupPhase.GuestReady || Option.isSome(progress.bootstrap.failure)) {
      request.resume();
      respond({ response, answer: { status: HttpStatusCode.Unavailable, headers: {}, body: '' } });

      return;
    }

    Queue.offerUnsafe(exchanges, { request, response });
  }

  const server = createServer(receive);

  const opening = Effect.callback<void, GuestUnreachable>((resume) => {
    server.once('error', (error) =>
      resume(new GuestUnreachable({ host: settings.host, port: settings.port, reason: error.message })),
    );
    server.listen(settings.port, settings.host, () => resume(Effect.void));
  });

  yield* Effect.acquireRelease(opening, () => closeServer({ server }));

  const bound = yield* Schema.decodeUnknownEffect(BoundAddress)(server.address()).pipe(
    Effect.mapError(
      (error) => new GuestUnreachable({ host: settings.host, port: settings.port, reason: error.message }),
    ),
  );

  writeResult({ line: Schema.encodeSync(ListeningLine)({ port: bound.port }) });
});
