import type { ContractEnforcement, ContractName } from '@mechane/rule-shapes';
import { codeTypescriptEffectErrors } from './code-typescript-effect-errors.ts';
import { codeTypescriptEffectSchemas } from './code-typescript-effect-schemas.ts';

/** The registry's entry for each contract of the Effect section, in the order of their folders. */
export const EFFECT_CONTRACTS = {
  'code-typescript-effect-errors': codeTypescriptEffectErrors,
  'code-typescript-effect-schemas': codeTypescriptEffectSchemas,
} as const satisfies Readonly<Partial<Record<ContractName, ContractEnforcement>>>;
