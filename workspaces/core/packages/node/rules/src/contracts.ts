import type { ContractEnforcement, ContractName } from '@mechane/rule-shapes';
import { FACTORY_CONTRACTS } from './contracts/local-rules/factory/factory-contracts.ts';
import { MECHANE_CONTRACTS } from './contracts/local-rules/mechane/mechane-contracts.ts';
import { NAME_CONTRACTS } from './contracts/name-rules/name-contracts.ts';
import { DATA_CONTRACTS } from './contracts/program-rules/data/data-contracts.ts';
import { EVAL_CONTRACTS } from './contracts/program-rules/evals/eval-contracts.ts';
import { PROGRAM_CONTRACTS } from './contracts/program-rules/programs/program-contracts.ts';
import { SECURITY_CONTRACTS } from './contracts/program-rules/security/security-contracts.ts';
import { TEST_CONTRACTS } from './contracts/program-rules/test-rules/test-contracts.ts';
import { BOUNDARY_CONTRACTS } from './contracts/structure-rules/boundaries/boundary-contracts.ts';
import { STRUCTURE_CONTRACTS } from './contracts/structure-rules/structure/structure-contracts.ts';
import { EFFECT_CONTRACTS } from './contracts/typescript-rules/effect/effect-contracts.ts';
import { TYPESCRIPT_CONTRACTS } from './contracts/typescript-rules/typescript/typescript-contracts.ts';
import { UI_CONTRACTS } from './contracts/ui-rules/ui-contracts.ts';

/**
 * What enforces each contract, by its name, in the order of the contract folders: the product's, then Mechane's own,
 * then the factory's. A contract without an entry fails to compile.
 */
export const CONTRACTS = {
  ...BOUNDARY_CONTRACTS,
  ...STRUCTURE_CONTRACTS,
  ...TYPESCRIPT_CONTRACTS,
  ...EFFECT_CONTRACTS,
  ...NAME_CONTRACTS,
  ...PROGRAM_CONTRACTS,
  ...DATA_CONTRACTS,
  ...TEST_CONTRACTS,
  ...SECURITY_CONTRACTS,
  ...EVAL_CONTRACTS,
  ...UI_CONTRACTS,
  ...MECHANE_CONTRACTS,
  ...FACTORY_CONTRACTS,
} as const satisfies Readonly<Record<ContractName, ContractEnforcement>>;
