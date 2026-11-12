import { createBrowserRuntime } from '@mechane/browser';
import type { GuestStatus } from '@mechane/sandbox-wire';
import { StartupPhase } from '@mechane/sandbox-wire';
import { Effect, FiberSet, Option, Queue } from 'effect';
import type { Scope } from 'effect';
import { delimiter, join } from 'node:path';
import { answerNextExchange } from './answer-next-exchange.ts';
import { prepareGuestTools } from './bootstrap/prepare-guest-tools.ts';
import type { StartupPhaseInput } from './bootstrap/startup-progress.ts';
import { createStartupProgress } from './bootstrap/startup-progress.ts';
import { GuestMisconfigured } from './errors.ts';
import type { ExecutionUnstarted } from './errors.ts';
import { executionLedger } from './executions/execution-ledger.ts';
import { listenToGuest } from './guest-listener.ts';
import { loadGuestSettings } from './load-guest-settings.ts';
import { processLedger } from './processes/process-ledger.ts';
import type { Exchange, GuestFailure } from './types.ts';
import { openWorkspaceFolder } from './workspace/open-workspace-folder.ts';
import { workspaceJournal } from './workspace/workspace-journal.ts';

/**
 * Binds preparation status before installing tools and admits tool requests only after the ledgers are ready. The scope
 * closes the listener and owned fibers when the guest stops; an execution that cannot start Bash or any defect still
 * ends the guest at once.
 */
export const serveGuest = Effect.fn('serveGuest')(function* (): Effect.fn.Return<void, GuestFailure, Scope.Scope> {
  const folder = yield* openWorkspaceFolder();
  const loadedSettings = yield* loadGuestSettings({ scratchDirectory: folder });

  const startup = createStartupProgress({ phase: StartupPhase.Bootstrap });
  const restoration = { progress: Option.none<ReturnType<typeof createStartupProgress>>() };

  function onRestorePhase({ phase, tool }: StartupPhaseInput): void {
    if (Option.isNone(restoration.progress)) {
      const created = createStartupProgress({ phase });

      restoration.progress = Option.some(created);
    } else {
      restoration.progress.value.advance({ phase, tool });
    }
  }

  function status(): GuestStatus {
    return { bootstrap: startup.read(), restoration: Option.map(restoration.progress, (value) => value.read()) };
  }

  const exchanges = yield* Queue.unbounded<Exchange>();

  yield* listenToGuest({ settings: loadedSettings, exchanges, startup: status });

  const preparing = prepareGuestTools({
    tools: loadedSettings.additionalTools,
    onPhase: startup.advance,
    target: loadedSettings.toolTarget,
    folder,
    path: loadedSettings.path,
    trustedCertificatesPem: loadedSettings.trustedCertificatesPem,
  });

  const managedTools = yield* preparing.pipe(
    Effect.catchTags({
      GuestMisconfigured: () => {
        startup.fail();

        return Effect.never;
      },
    }),
  );

  const settings = { ...loadedSettings, path: [managedTools, loadedSettings.path].join(delimiter) };
  const fibers = yield* FiberSet.make<void, ExecutionUnstarted>();
  const ledger = executionLedger({ settings, fibers });
  const processes = processLedger({ settings, ledger, fibers });
  const browserDirectory = join(folder, 'browser');

  const browser = yield* createBrowserRuntime({
    home: settings.home,
    scratchDirectory: browserDirectory,
    path: settings.path,
    chromiumExecutable: 'chromium',
    displayExecutable: 'Xvfb',
    encoderExecutable: 'ffmpeg',
    mediaProbeExecutable: 'ffprobe',
    isSandboxDisabled: settings.isBrowserSandboxDisabled,
    certificateFile: settings.browserCertificateFile,
    activity: { admit: ledger.admitProcess, finish: ledger.finishProcessStart },
  }).pipe(Effect.mapError(({ reason }) => new GuestMisconfigured({ reason })));

  function ownedProcessGroups(): ReadonlyArray<number> {
    return [...processes.ownedProcessGroups(), ...browser.ownedProcessGroups()];
  }

  const workspace = workspaceJournal({
    folder,
    settings,
    ledger,
    fibers,
    ownedProcessGroups,
    isBusy: browser.isBusy,
    onRestorePhase,
  });

  const tool = Option.none<string>();

  startup.advance({ phase: StartupPhase.GuestReady, tool });

  const next = answerNextExchange({ exchanges, fibers, settings, ledger, workspace, processes, browser });
  const serving = Effect.forever(next);

  yield* FiberSet.run(fibers, serving);

  return yield* FiberSet.join(fibers);
}, Effect.scoped);
