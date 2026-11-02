import type { ContractEnforcement, ContractName } from '@mechane/rule-shapes';
import { codeClosedValueSets } from './code-closed-value-sets.ts';
import { codeConditionalExpressions } from './code-conditional-expressions.ts';
import { codeExhaustiveBranches } from './code-exhaustive-branches.ts';
import { codeFolderSize } from './code-folder-size.ts';
import { codeFunctionSize } from './code-function-size.ts';
import { codeGuardClauses } from './code-guard-clauses.ts';
import { codeModuleFileRoles } from './code-module-file-roles.ts';
import { codeModuleStructureAndControlFlow } from './code-module-structure-and-control-flow.ts';

/** The registry's entry for each contract of the structure section, in the order of their folders. */
export const STRUCTURE_CONTRACTS = {
  'code-module-structure-and-control-flow': codeModuleStructureAndControlFlow,
  'code-module-file-roles': codeModuleFileRoles,
  'code-folder-size': codeFolderSize,
  'code-function-size': codeFunctionSize,
  'code-guard-clauses': codeGuardClauses,
  'code-conditional-expressions': codeConditionalExpressions,
  'code-exhaustive-branches': codeExhaustiveBranches,
  'code-closed-value-sets': codeClosedValueSets,
} as const satisfies Readonly<Partial<Record<ContractName, ContractEnforcement>>>;
