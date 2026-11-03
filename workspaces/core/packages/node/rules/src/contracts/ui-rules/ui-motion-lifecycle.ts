import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Motion lifecycle and reduced-motion behavior are checked in the built browser. */
export const uiMotionLifecycle = { values: {}, rules: [] } as const satisfies ContractEnforcement;
