import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Cloud lifecycle evidence and ownership review enforce this contract outside the TypeScript rule registry. */
export const installationOwnership = { values: {}, rules: [] } as const satisfies ContractEnforcement;
