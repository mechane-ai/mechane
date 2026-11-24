import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Teaching layers share one lesson store, one clock and the plot kernel; review decides. */
export const uiTeachingLayers = { values: {}, rules: [] } as const satisfies ContractEnforcement;
