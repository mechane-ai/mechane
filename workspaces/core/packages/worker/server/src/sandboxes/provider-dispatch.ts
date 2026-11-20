import type { RuntimeConfiguration } from '@mechane/runtime';
import { createModalSandboxProvider } from '@mechane/sandbox-modal';
import type { SandboxProviderAdapter } from '@mechane/sandbox-provider';
import { createTensorlakeSandboxProvider } from '@mechane/sandbox-tensorlake';
import { Redacted } from 'effect';

export type ResolvedSandboxBackend =
  | { readonly kind: 'cloudflare' }
  | { readonly kind: 'none' }
  | { readonly kind: 'adapter'; readonly adapter: SandboxProviderAdapter };

/** Resolves the configured sandbox backend at the server composition seam. */
export function resolveSandboxBackend(configuration: RuntimeConfiguration): ResolvedSandboxBackend {
  const { sandbox } = configuration;

  if (sandbox.provider === 'cloudflare') {
    return { kind: 'cloudflare' };
  }

  if (sandbox.provider === 'tensorlake') {
    if (sandbox.tensorlake.apiKey === null) {
      throw new Error('Missing runtime setting MECHANE_TENSORLAKE_API_KEY');
    }

    return {
      kind: 'adapter',
      adapter: createTensorlakeSandboxProvider({
        apiKey: Redacted.value(sandbox.tensorlake.apiKey),
        baseUrl: sandbox.tensorlake.baseUrl,
      }),
    };
  }

  if (sandbox.provider === 'modal') {
    if (sandbox.modal.baseUrl === null || sandbox.modal.bearerToken === null) {
      throw new Error('Missing Modal sandbox bridge configuration');
    }

    return {
      kind: 'adapter',
      adapter: createModalSandboxProvider({
        baseUrl: sandbox.modal.baseUrl,
        bearerToken: Redacted.value(sandbox.modal.bearerToken),
        appName: sandbox.modal.appName,
      }),
    };
  }

  return { kind: 'none' };
}
