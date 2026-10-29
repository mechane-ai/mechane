import { DeployFailed, DeployMode, DeployStep, EXAMPLE_CONFIGURATION } from '@mechane/deploy-kernel';
import { Effect, Option } from 'effect';
import { resolve } from 'node:path';

type ResolveInstallationPathInput = {
  /** Absent selects the public example only in render mode; cloud modes require an explicit path. */
  readonly requested: Option.Option<string>;
  readonly mode: DeployMode;
};

/** The check can render the example, but cloud operations cannot silently choose an installation. */
export const resolveInstallationPath = Effect.fn('resolveInstallationPath')(function* ({
  requested,
  mode,
}: ResolveInstallationPathInput): Effect.fn.Return<string, DeployFailed> {
  if (Option.isNone(requested) && mode !== DeployMode.Render) {
    return yield* new DeployFailed({
      step: DeployStep.ReadCommandLine,
      reason: 'name an installation with --config or MECHANE_DEPLOY_CONFIG_FILE',
    });
  }

  const path = Option.getOrElse(requested, () => EXAMPLE_CONFIGURATION);

  return resolve(path);
});
