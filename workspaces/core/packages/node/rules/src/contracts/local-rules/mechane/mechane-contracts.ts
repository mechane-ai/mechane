import type { ContractEnforcement, ContractName } from '@mechane/rule-shapes';
import { codeStyle } from './code-style.ts';
import { consoleBoundaries } from './console-boundaries.ts';
import { installationOwnership } from './installation-ownership.ts';
import { packageLayers } from './package-layers.ts';
import { ruleRegistry } from './rule-registry.ts';

/** The registry's entry for each contract of Mechane's own section, in the order of their folders. */
export const MECHANE_CONTRACTS = {
  'package-layers': packageLayers,
  'rule-registry': ruleRegistry,
  'code-style': codeStyle,
  'installation-ownership': installationOwnership,
  'console-boundaries': consoleBoundaries,
} as const satisfies Readonly<Partial<Record<ContractName, ContractEnforcement>>>;
