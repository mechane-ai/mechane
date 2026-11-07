import { ADOPTED, CRUISER_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Native browser persistence owns the Worker; the cache lifecycle only composes its public API. */
export const consoleCacheLifecycle = {
  values: {},
  rules: [
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'console-cache-persistence-owner',
      comment:
        'Keep native persistence composition in the cache lifecycle, such as `console-cache/src/store/storage.ts`',
      from: { path: '^packages/', pathNot: '^packages/browser/console-cache/src/store/storage[.]ts$' },
      to: { path: 'node_modules/@tanstack/browser-db-sqlite-persistence/' },
      standard: '119',
    },
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'console-cache-native-worker',
      comment:
        'Use the native persistence API, such as `openBrowserWASQLiteOPFSDatabase`, instead of the raw wa-sqlite driver',
      from: { path: '^packages/' },
      to: { path: 'node_modules/@journeyapps/wa-sqlite/' },
      standard: '119',
    },
  ],
} as const satisfies ContractEnforcement;
