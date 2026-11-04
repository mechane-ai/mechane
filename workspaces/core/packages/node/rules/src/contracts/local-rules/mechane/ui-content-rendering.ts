import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Browser review and bounded component APIs establish safe content rendering and exact copy behavior. */
export const uiContentRendering = { values: {}, rules: [] } as const satisfies ContractEnforcement;
