import { ADOPTED, AST_GREP_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** What enforces `data-store-ownership`: storage calls, tables and stored files only in the store that owns them. */
export const dataStoreOwnership = {
  values: {},
  rules: [
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'storage-call-outside-store',
      standard: 'DO-06',
      violation: ['this.ctx.storage.get(key);', 'this.ctx.storage.setAlarm(at);'],
      allowed: ['turnStore.readTurn({ turnId });'],
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'stored-name-outside-store',
      standard: 'DO-06',
      violation: ["const path = 'credentials.json';"],
      allowed: ["const path = 'notes.json';"],
    },
  ],
} as const satisfies ContractEnforcement;
