import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Folder cohesion depends on ownership and navigation, so this contract is reviewed directly. */
export const codeFolderSize = { values: {}, rules: [] } as const satisfies ContractEnforcement;
