import { ADOPTED, CRUISER_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Stored-state inspection has no dependency on execution or provider operations. */
export const environmentStartup = {
  values: {},
  rules: [
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'sandbox-inspection-owner',
      comment:
        'Read stored observations in inspection, such as `store.latestStartup()`; prepare computers through the machine owner (131)',
      from: { path: '^packages/worker/sandbox/src/inspection/' },
      to: {
        path: '^packages/worker/sandbox/src/',
        pathNot: '^packages/worker/sandbox/src/(?:inspection/|checkpoints/checkpoint-inactive-environment[.]ts$)',
      },
      standard: '131',
    },
  ],
} as const satisfies ContractEnforcement;
