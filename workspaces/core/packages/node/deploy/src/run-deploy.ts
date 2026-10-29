import { DeployFailed, DeployMode, DeployStep } from '@mechane/deploy-kernel';
import { checkCheckout, runPreflight } from '@mechane/deploy-preflight';
import { renderConfiguration } from '@mechane/deploy-render';
import { interruptOnSignal, writeResult } from '@mechane/program';
import { DIRTY_SUFFIX } from '@mechane/release';
import { Effect, Option } from 'effect';
import { loadDeploySettings } from './load-deploy-settings.ts';
import { deployRelease } from './rollout/deploy-release.ts';
import { rollBack } from './rollout/roll-back.ts';
import { uploadBuiltRelease } from './rollout/upload-built-release.ts';

/**
 * Runs the mode the command line names until it ends, or until a stop signal interrupts it, which fails the run. The
 * interrupted mode's finalizers remove its secrets file and stop its children first.
 */
export const runDeploy = Effect.fn('runDeploy')(function* (): Effect.fn.Return<void, DeployFailed> {
  const ended = yield* interruptOnSignal({ program: runMode() });

  if (Option.isNone(ended)) {
    return yield* new DeployFailed({ step: DeployStep.RunMode, reason: 'a stop signal interrupted its mode' });
  }
});

/**
 * Uploads the CLI's built release, or renders production's configuration, which every other mode does first. From a
 * clean checkout only, it then checks that the checkout can deploy it, deploys it, or rolls production back.
 */
const runMode = Effect.fn('runMode')(function* (): Effect.fn.Return<void, DeployFailed> {
  const settings = yield* loadDeploySettings();

  if (settings.mode === DeployMode.Upload) {
    yield* checkCheckout({ settings });

    return yield* uploadBuiltRelease({ settings });
  }

  const rendered = yield* renderConfiguration({ settings });

  if (settings.mode === DeployMode.Render) {
    return writeResult({ line: rendered.configurationPath });
  }

  if (rendered.revision.endsWith(DIRTY_SUFFIX)) {
    const reason = `${settings.mode} runs from a clean tree, and ${rendered.revision} has uncommitted changes; only render takes a dirty tree`;

    return yield* new DeployFailed({ step: DeployStep.CheckCleanRevision, reason });
  }

  switch (settings.mode) {
    case DeployMode.Preflight:
      yield* runPreflight({ settings, rendered });

      break;
    case DeployMode.Deploy:
      return yield* deployRelease({ settings, rendered });
    case DeployMode.Rollback:
      return yield* rollBack({ settings, rendered });
  }
});
