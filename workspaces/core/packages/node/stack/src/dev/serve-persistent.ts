import { ORIGIN_VARIABLE } from '@mechane/deployment';
import { writeDiagnostic, writeResult } from '@mechane/program';
import { installScriptUrl, localSignInUrl } from '@mechane/protocol';
import type { ReleaseFailed } from '@mechane/release';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import type { StackFailed } from '../errors.ts';
import { startLocalStack } from '../start-local-stack.ts';
import type { LocalStack, StackSettings } from '../types.ts';
import { PROGRAM } from './constants.ts';
import { publishSourceRelease } from './publish-source-release.ts';

type ServePersistentInput = { readonly settings: StackSettings };
type AnnounceLocalInput = { readonly stack: LocalStack };

/** Serves the retained local installation and its source-built CLI until interrupted. */
export const servePersistent = Effect.fn('servePersistent')(function* ({
  settings,
}: ServePersistentInput): Effect.fn.Return<void, StackFailed | ReleaseFailed, Scope.Scope> {
  writeDiagnostic({
    program: PROGRAM,
    line: `starting Mechane at ${settings.localOrigin.origin}; Docker builds the sandbox image when needed`,
  });

  const stack = yield* startLocalStack({ settings });

  yield* publishSourceRelease({ stack });
  announceLocal({ stack });

  return yield* Effect.never;
});

function announceLocal({ stack }: AnnounceLocalInput): void {
  const origin = stack.origin.origin;
  const installer = installScriptUrl({ origin: stack.origin });
  const signIn = localSignInUrl({ origin: stack.origin });

  const lines = [
    `serving Mechane at ${origin}; stop with Ctrl-C`,
    `local state stays in ${stack.stateFolder}; celld logs to ${stack.logFile}`,
    `open ${signIn.href} and paste the secret from ${stack.bootstrapSecretFile}`,
    `sign in with ${ORIGIN_VARIABLE}=${origin} mise run mechane -- auth login`,
    `install the CLI with curl -fsSL ${installer.href} | sh`,
    'sandboxes run as Docker containers; stopping the stack retains agents and sandbox files',
  ];

  writeResult({ line: `export ${ORIGIN_VARIABLE}=${origin}` });

  for (const line of lines) {
    writeDiagnostic({ program: PROGRAM, line });
  }
}
