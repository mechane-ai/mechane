import { writeResult } from '@mechane/program';
import { GuestListening } from '@mechane/sandbox-wire';
import { Effect, FiberSet, Queue, Schema } from 'effect';
import type { Scope } from 'effect';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { answerNextExchange } from './answer-next-exchange.ts';
import { closeServer } from './close-server.ts';
import { GuestUnreachable } from './errors.ts';
import type { ExecutionUnstarted } from './errors.ts';
import { executionLedger } from './executions/execution-ledger.ts';
import { loadGuestSettings } from './load-guest-settings.ts';
import { sourceJournal } from './sources/journal/source-journal.ts';
import type { Exchange, GuestFailure } from './types.ts';
import { openWorkspaceFolder } from './workspace/open-workspace-folder.ts';
import { workspaceJournal } from './workspace/workspace-journal.ts';

/** The address a listening TCP server reports, read only for its port. */
const BoundAddress = Schema.Struct({ port: Schema.Int });
const GuestListeningLine = Schema.fromJsonString(GuestListening);

type BoundAddress = typeof BoundAddress.Type;

type ListenInput = { readonly server: Server; readonly host: string; readonly port: number };

/**
 * Serves the machine's executions until it is interrupted or one of its fibers fails. Once it writes the port it
 * listens on as one line, it answers each request in a fiber of its own. A run that could not start bash, or any
 * defect, ends the guest at once, which closes the server and stops every execution.
 */
export const serveGuest = Effect.fn('serveGuest')(function* (): Effect.fn.Return<void, GuestFailure, Scope.Scope> {
  const settings = yield* loadGuestSettings();
  const fibers = yield* FiberSet.make<void, ExecutionUnstarted>();
  const ledger = executionLedger({ settings, fibers });
  const folder = yield* openWorkspaceFolder();
  const workspace = workspaceJournal({ folder, settings, ledger, fibers });
  const source = sourceJournal({ settings, ledger });
  const exchanges = yield* Queue.unbounded<Exchange>();

  const queueExchange: (request: IncomingMessage, response: ServerResponse) => void = (request, response) =>
    Queue.offerUnsafe(exchanges, { request, response });

  const server = createServer(queueExchange);
  const listening = listen({ server, host: settings.host, port: settings.port });
  const port = yield* Effect.acquireRelease(listening, () => closeServer({ server }));

  // The guest's one result, which its starter reads: the port it listens on, a number the server reported, so its
  // encoding cannot fail.
  const line = Schema.encodeSync(GuestListeningLine)({ port });

  writeResult({ line });

  const next = answerNextExchange({ exchanges, fibers, settings, ledger, workspace, source });
  const serving = Effect.forever(next);

  yield* FiberSet.run(fibers, serving);

  return yield* FiberSet.join(fibers);
}, Effect.scoped);

/** Listens on the host and port, and answers with the port bound, which the system chose for a port of 0. */
const listen = Effect.fn('listen')(function* ({
  server,
  host,
  port,
}: ListenInput): Effect.fn.Return<number, GuestUnreachable> {
  yield* Effect.callback<void, GuestUnreachable>((resume) => {
    const refuse: (error: Error) => void = (error) => {
      const failure = new GuestUnreachable({ host, port, reason: error.message });

      resume(failure);
    };

    const listening: () => void = () => resume(Effect.void);

    server.once('error', refuse);
    server.listen(port, host, listening);
  });

  const address = server.address();

  const bound = yield* Schema.decodeUnknownEffect(BoundAddress)(address).pipe(
    Effect.mapError((error) => new GuestUnreachable({ host, port, reason: error.message })),
  );

  return bound.port;
});
