import { interruptOnSignal } from '@mechane/program';
import type { ReleaseFailed } from '@mechane/release';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { LocalCommand } from '../constants.ts';
import type { StackFailed } from '../errors.ts';
import { loadStackSettings } from '../load-stack-settings.ts';
import { resetLocalStack } from './reset-local-stack.ts';
import { serveFixture } from './serve-fixture.ts';
import { servePersistent } from './serve-persistent.ts';

/** Dispatches the local command and closes its resources when a stop signal arrives. */
export const serveLocally = Effect.fn('serveLocally')(function* (): Effect.fn.Return<
  void,
  StackFailed | ReleaseFailed
> {
  yield* interruptOnSignal({ program: serveCommand() });
});

const serveCommand = Effect.fn('serveCommand')(function* (): Effect.fn.Return<
  void,
  StackFailed | ReleaseFailed,
  Scope.Scope
> {
  const settings = yield* loadStackSettings();

  switch (settings.localCommand) {
    case LocalCommand.Reset:
      return yield* resetLocalStack({ settings });
    case LocalCommand.Fixture:
      return yield* serveFixture({ settings });
    case LocalCommand.Default:
    case LocalCommand.Start:
      return yield* servePersistent({ settings });
  }
}, Effect.scoped);
