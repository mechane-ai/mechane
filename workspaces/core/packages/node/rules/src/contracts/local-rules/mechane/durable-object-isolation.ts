import { ADOPTED, AST_GREP_DEFAULTS, CRUISER_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Enforces separation between lightweight per-agent slot arbitration and unprefixed per-session Pi Durable Objects. */
export const durableObjectIsolation = {
  values: {},
  rules: [
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'agent-slot-isolation',
      comment:
        'Keep per-agent slot arbitration free of Pi Durable, providers, and catalog stores, such as `agent-slot-object.ts`',
      from: { path: '^packages/worker/agent-slot/' },
      to: {
        path: '(?:node_modules/@earendil-works/(?:pi-durable|pi-ai)/|^packages/worker/(?:authority|managed|control)-store/)',
      },
      standard: '135',
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'no-prefixed-session-sqlite',
      standard: '135',
      violation: ['await openDurableObjectSqliteStorage(storage, { prefix });'],
      allowed: ['await openDurableObjectSqliteStorage(storage);'],
    },
  ],
} as const satisfies ContractEnforcement;
