import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Resource and draft behavior is reviewed at the owning interaction boundary. */
export const uiPresentationState = { values: {}, rules: [] } as const satisfies ContractEnforcement;
