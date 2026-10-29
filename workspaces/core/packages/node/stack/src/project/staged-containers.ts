import { LocalSandboxProvider } from '@mechane/deployment';
import type { BaseConfiguration } from '@mechane/wrangler';

type StagedContainersInput = LocalSandboxProviderInput & Pick<BaseConfiguration, 'containers'>;

type LocalSandboxProviderInput = { readonly sandboxProvider: LocalSandboxProvider };

/** The staged configuration's `containers` key, or none for host sandboxes. */
type StagedContainers = Pick<BaseConfiguration, 'containers'> | Readonly<Record<string, never>>;

/**
 * The `containers` a stack stages: none for host sandboxes, so celld needs no Docker; for containers, the base's, whose
 * images build in the same build folder a deploy builds.
 */
export function stagedContainers({ sandboxProvider, containers }: StagedContainersInput): StagedContainers {
  switch (sandboxProvider) {
    case LocalSandboxProvider.Host:
      return {};
    case LocalSandboxProvider.Container:
      return { containers };
  }
}
