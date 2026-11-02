import type { ContractEnforcement, ContractName } from '@mechane/rule-shapes';
import { codeDependencyBoundaries } from './code-dependency-boundaries.ts';
import { codeExportConsumers } from './code-export-consumers.ts';
import { codeOwnershipAndBoundaries } from './code-ownership-and-boundaries.ts';
import { codeTypescriptEntryPoints } from './code-typescript-entry-points.ts';
import { codeTypescriptModuleBoundaries } from './code-typescript-module-boundaries.ts';
import { codeTypescriptPackageBoundaries } from './code-typescript-package-boundaries.ts';

/** The registry's entry for each contract of the boundaries section, in the order of their folders. */
export const BOUNDARY_CONTRACTS = {
  'code-ownership-and-boundaries': codeOwnershipAndBoundaries,
  'code-dependency-boundaries': codeDependencyBoundaries,
  'code-typescript-package-boundaries': codeTypescriptPackageBoundaries,
  'code-typescript-module-boundaries': codeTypescriptModuleBoundaries,
  'code-typescript-entry-points': codeTypescriptEntryPoints,
  'code-export-consumers': codeExportConsumers,
} as const satisfies Readonly<Partial<Record<ContractName, ContractEnforcement>>>;
