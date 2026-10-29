import { FACTORY_CONTRACTS, MECHANE_CONTRACTS } from '@mechane/local-rules';
import { NAME_CONTRACTS } from '@mechane/name-rules';
import {
  DATA_CONTRACTS,
  EVAL_CONTRACTS,
  PROGRAM_CONTRACTS,
  SECURITY_CONTRACTS,
  TEST_CONTRACTS,
} from '@mechane/program-rules';
import type { ContractEnforcement, ContractName } from '@mechane/rule-shapes';
import { BOUNDARY_CONTRACTS, STRUCTURE_CONTRACTS } from '@mechane/structure-rules';
import { EFFECT_CONTRACTS, TYPESCRIPT_CONTRACTS } from '@mechane/typescript-rules';

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
  ...MECHANE_CONTRACTS,
  ...FACTORY_CONTRACTS,
} as const satisfies Readonly<Record<ContractName, ContractEnforcement>>;
