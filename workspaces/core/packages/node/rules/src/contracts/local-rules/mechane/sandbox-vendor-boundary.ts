import { ADOPTED, CRUISER_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Enforces that managed runtime, HTTP handlers, and concrete sandbox adapters stay mutually isolated. */
export const sandboxVendorBoundary = {
  values: {},
  rules: [
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'managed-sandbox-vendor-boundary',
      comment:
        'Route managed sandbox execution through the Environment Work protocol or `@mechane/sandbox-provider`, such as `managed_work`',
      from: { path: '^packages/worker/(?:runtime|server)/src/managed/' },
      to: { path: '^packages/(?:worker/sandbox(?:-store)?|shared/sandbox-(?:modal|tensorlake)|node/sandbox-docker)/' },
      standard: '137',
    },
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'sandbox-modal-isolation',
      comment:
        'Keep `@mechane/sandbox-modal` isolated from sibling adapters by importing `@mechane/sandbox-provider`, such as `requestSandboxJson`',
      from: { path: '^packages/shared/sandbox-modal/' },
      to: { path: '^packages/(?:shared/sandbox-tensorlake|worker/sandbox(?:-store)?|node/sandbox-docker)/' },
      standard: '137',
    },
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'sandbox-tensorlake-isolation',
      comment:
        'Keep `@mechane/sandbox-tensorlake` isolated from sibling adapters by importing `@mechane/sandbox-provider`, such as `requestSandboxJson`',
      from: { path: '^packages/shared/sandbox-tensorlake/' },
      to: { path: '^packages/(?:shared/sandbox-modal|worker/sandbox(?:-store)?|node/sandbox-docker)/' },
      standard: '137',
    },
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'sandbox-docker-isolation',
      comment:
        'Keep `@mechane/sandbox-docker` isolated from sibling adapters by importing `@mechane/sandbox-provider`, such as `SandboxProviderAdapter`',
      from: { path: '^packages/node/sandbox-docker/' },
      to: { path: '^packages/(?:shared/sandbox-(?:modal|tensorlake)|worker/sandbox(?:-store)?)/' },
      standard: '137',
    },
  ],
} as const satisfies ContractEnforcement;
