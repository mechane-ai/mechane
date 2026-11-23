import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Kits compose the Elements families through their public entries and draw no marks of their own; review decides. */
export const uiDomainKits = { values: {}, rules: [] } as const satisfies ContractEnforcement;
