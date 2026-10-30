import { interruptOnSignal, writeDiagnostic } from '@mechane/program';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { LocalCommand, PROGRAM, StackStep } from '../constants.ts';
import { resetLocalStack } from '../dev/reset-local-stack.ts';
import { StackFailed } from '../errors.ts';
import { loadStackSettings } from '../load-stack-settings.ts';
import { localModelSettings } from '../settings/local-model-settings.ts';
import { startLocalStack } from '../start-local-stack.ts';
import { announcePackage } from './announce-package.ts';
import { loadGuestImage } from './load-guest-image.ts';
import { packageProject } from './package-project.ts';
import { readLocalPackage } from './read-local-package.ts';

/** Runs the installed release with the same retained state and signal cleanup as source mode. */
export const servePackage = Effect.fn('servePackage')(function* (): Effect.fn.Return<void, StackFailed> {
  const program = serveInstalled();

  yield* interruptOnSignal({ program });
});

const serveInstalled = Effect.fn('serveInstalled')(function* (): Effect.fn.Return<void, StackFailed, Scope.Scope> {
  const settings = yield* loadStackSettings();

  if (settings.localCommand === LocalCommand.Reset) {
    return yield* resetLocalStack({ settings });
  }

  if (settings.localCommand === LocalCommand.Fixture) {
    return yield* new StackFailed({
      step: StackStep.ReadLocalSettings,
      reason: 'the installed launcher accepts start or reset --confirm',
    });
  }

  yield* localModelSettings({ settings });

  const folder = settings.executableFolder;
  const manifest = yield* readLocalPackage({ folder });
  const project = yield* packageProject({ folder, manifest });

  writeDiagnostic({ program: PROGRAM, line: `starting Mechane ${manifest.version} at ${settings.localOrigin.origin}` });
  yield* loadGuestImage({ settings });

  const stack = yield* startLocalStack({ settings, project });

  announcePackage({ stack, folder });

  return yield* Effect.never;
}, Effect.scoped);
