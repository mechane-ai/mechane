import type { ContractEnforcement, ContractName } from '@mechane/rule-shapes';
import { testScenarioFunctions } from './test-scenario-functions.ts';
import { testSupportModules } from './test-support-modules.ts';

/** The registry's entry for each contract of the tests section, in the order of their folders. */
export const TEST_CONTRACTS = {
  'test-scenario-functions': testScenarioFunctions,
  'test-support-modules': testSupportModules,
} as const satisfies Readonly<Partial<Record<ContractName, ContractEnforcement>>>;
