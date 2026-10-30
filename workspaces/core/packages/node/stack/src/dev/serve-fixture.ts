import { ORIGIN_VARIABLE } from '@mechane/deployment';
import { writeDiagnostic, writeResult } from '@mechane/program';
import type { ReleaseFailed } from '@mechane/release';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { LOCAL_GITHUB, PROGRAM } from '../constants.ts';
import type { StackFailed } from '../errors.ts';
import { startStack } from '../start-stack.ts';
import type { StackSettings } from '../types.ts';
import { publishSourceRelease } from './publish-source-release.ts';

type ServeFixtureInput = { readonly settings: StackSettings };

/** Serves a disposable stack with scripted identity and model services until interrupted. */
export const serveFixture = Effect.fn('serveFixture')(function* ({
  settings,
}: ServeFixtureInput): Effect.fn.Return<void, StackFailed | ReleaseFailed, Scope.Scope> {
  const stack = yield* startStack({ settings, variables: {}, sandboxProvider: settings.sandboxProvider });

  yield* publishSourceRelease({ stack });

  const origin = stack.origin.origin;

  const lines = [
    `serving a disposable fixture at ${origin}; stop with Ctrl-C`,
    `fixture state at ${stack.stateFolder} is removed on shutdown`,
    `the fake GitHub at ${stack.githubOrigin.origin} signs in as ${LOCAL_GITHUB.login} or a typed login`,
    'the scripted model answers without a paid model call; use mise run start for persistent local Mechane',
  ];

  writeResult({ line: `export ${ORIGIN_VARIABLE}=${origin}` });

  for (const line of lines) {
    writeDiagnostic({ program: PROGRAM, line });
  }

  return yield* Effect.never;
});
