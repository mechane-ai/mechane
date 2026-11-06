import { ADOPTED, CRUISER_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Terminating the owning Worker releases Turso's nested file handles after an incomplete open. */
export const consoleCacheLifecycle = {
  values: {},
  rules: [
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'console-cache-worker-driver',
      comment: 'Open Turso only in the cache Worker, such as `packages/browser/console-cache/src/store/worker/main.ts`',
      from: {
        path: '^packages/browser/console-cache/',
        pathNot: '^packages/browser/console-cache/src/store/worker/main[.]ts$',
      },
      to: { path: 'node_modules/@tursodatabase/database-wasm/' },
      standard: '119',
    },
  ],
} as const satisfies ContractEnforcement;
