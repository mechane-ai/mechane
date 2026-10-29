import { checkRefusals, DeployStep } from '@mechane/deploy-kernel';
import type { DeployFailed, ProgramSettings, SettingsInput } from '@mechane/deploy-kernel';
import { SandboxProvider, WORKER_VARIABLES } from '@mechane/deployment';
import type { BaseConfiguration } from '@mechane/wrangler';
import { Effect, Option } from 'effect';

type RenderContainersInput = { readonly settings: ProgramSettings; readonly base: BaseConfiguration };

/** Cloudflare builds the same guest Dockerfile that the local container stack runs. */
export const renderContainers = Effect.fn('renderContainers')(function* ({
  settings,
  base,
}: RenderContainersInput): Effect.fn.Return<BaseConfiguration['containers'], DeployFailed> {
  yield* validateProvider({ settings });

  const container = Option.fromNullishOr(settings.installation.container);

  if (Option.isNone(container)) {
    return [];
  }

  return base.containers.map((entry) => ({ ...entry, ...container.value }));
});

const validateProvider = Effect.fn('validateProvider')(function* ({
  settings,
}: SettingsInput): Effect.fn.Return<void, DeployFailed> {
  const { installation } = settings;
  const provider = installation.vars[WORKER_VARIABLES.sandboxProvider];
  const image = Option.fromNullishOr(installation.tensorlake_image_prefix);
  const secret = Option.fromNullishOr(installation.secret_refs[WORKER_VARIABLES.tensorlakeApiKey]);
  const container = Option.fromNullishOr(installation.container);
  const hasImage = Option.isSome(image);
  const hasSecret = Option.isSome(secret);
  const hasContainer = Option.isSome(container);

  return yield* checkRefusals({
    step: DeployStep.ReadOverlay,
    subjects: [],
    refusals: [
      {
        isRefused: hasImage !== hasSecret,
        reason: 'Tensorlake requires both an image prefix and its secret reference',
      },
      {
        isRefused: provider === SandboxProvider.Tensorlake && (!hasImage || hasContainer),
        reason: 'Tensorlake requires an image prefix and no container configuration',
      },
      {
        isRefused: provider === SandboxProvider.Container && !hasContainer,
        reason: 'Containers requires its application name, instance type and instance limit',
      },
    ],
  });
});
