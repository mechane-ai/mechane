import { WORKSPACE_FOLDER } from '@mechane/checks-kernel';
import { Effect, Queue, Ref } from 'effect';
import type { Scope } from 'effect';
import { pathToFileURL } from 'node:url';
import type { ServerExited } from '../errors.ts';
import { ServerRefused } from '../errors.ts';
import type { ServerMessage } from '../schemas.ts';
import type { LanguageServer, ServerChild } from '../types.ts';
import { notify } from './notify.ts';
import { request } from './request.ts';
import { spawnServer } from './spawn-server.ts';

/**
 * The language server's preferences: a rename changes the name everywhere, rather than keeping the old one as an alias
 * at an export, a shorthand property or a destructuring.
 */
const SERVER_SETTINGS = { typescript: { preferences: { useAliasesForRenames: false } } } as const;

/** The queue the server's messages arrive on. */
type RunningServerInput = { readonly messages: Queue.Queue<ServerMessage, ServerExited> };

/**
 * Starts the compiler's language server, which the program asks one request at a time, and gives it the rename
 * preferences. Closing the scope stops it, and a server that exits first fails the request that waits on it.
 */
export const startLanguageServer = Effect.fn('startLanguageServer')(function* (): Effect.fn.Return<
  LanguageServer,
  ServerExited | ServerRefused,
  Scope.Scope
> {
  const messages = yield* Queue.unbounded<ServerMessage, ServerExited>();
  const child = yield* runningServer({ messages });

  const server = {
    child,
    messages,
    ids: yield* Ref.make(1),
    versions: yield* Ref.make<ReadonlyMap<string, number>>(new Map()),
  };

  const initialized = yield* request({
    server,
    method: 'initialize',
    params: { processId: process.pid, rootUri: pathToFileURL(WORKSPACE_FOLDER).href, capabilities: {} },
  });

  if ('refusal' in initialized) {
    return yield* new ServerRefused({ reason: initialized.refusal });
  }

  notify({ server, method: 'initialized', params: {} });
  notify({ server, method: 'workspace/didChangeConfiguration', params: { settings: SERVER_SETTINGS } });

  return server;
});

/** The server's process for the scope, which the scope's end kills. */
const runningServer = Effect.fn('runningServer')(function* ({
  messages,
}: RunningServerInput): Effect.fn.Return<ServerChild, never, Scope.Scope> {
  const { child } = yield* Effect.acquireRelease(
    Effect.sync(() => spawnServer({ messages })),
    ({ kill }) => Effect.sync(kill),
  );

  return child;
});
