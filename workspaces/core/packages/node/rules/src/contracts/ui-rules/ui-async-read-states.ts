import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Packaged-browser review distinguishes initial and retained read states. */
export const uiAsyncReadStates = { values: {}, rules: [] } as const satisfies ContractEnforcement;
