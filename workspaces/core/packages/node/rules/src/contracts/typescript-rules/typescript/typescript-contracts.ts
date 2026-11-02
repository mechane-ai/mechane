import type { ContractEnforcement, ContractName } from '@mechane/rule-shapes';
import { codeTypescriptCallArguments } from './code-typescript-call-arguments.ts';
import { codeTypescriptClassDeclarations } from './code-typescript-class-declarations.ts';
import { codeTypescriptCompilerStrictness } from './code-typescript-compiler-strictness.ts';
import { codeTypescriptConstBindings } from './code-typescript-const-bindings.ts';
import { codeTypescriptFileNames } from './code-typescript-file-names.ts';
import { codeTypescriptFunctionArguments } from './code-typescript-function-arguments.ts';
import { codeTypescriptInputImmutability } from './code-typescript-input-immutability.ts';
import { codeTypescriptModuleState } from './code-typescript-module-state.ts';
import { codeTypescriptNamedTypes } from './code-typescript-named-types.ts';
import { codeTypescriptTypeAssertions } from './code-typescript-type-assertions.ts';

/** The registry's entry for each contract of the TypeScript section, in the order of their folders. */
export const TYPESCRIPT_CONTRACTS = {
  'code-typescript-const-bindings': codeTypescriptConstBindings,
  'code-typescript-input-immutability': codeTypescriptInputImmutability,
  'code-typescript-type-assertions': codeTypescriptTypeAssertions,
  'code-typescript-named-types': codeTypescriptNamedTypes,
  'code-typescript-function-arguments': codeTypescriptFunctionArguments,
  'code-typescript-class-declarations': codeTypescriptClassDeclarations,
  'code-typescript-module-state': codeTypescriptModuleState,
  'code-typescript-compiler-strictness': codeTypescriptCompilerStrictness,
  'code-typescript-file-names': codeTypescriptFileNames,
  'code-typescript-call-arguments': codeTypescriptCallArguments,
} as const satisfies Readonly<Partial<Record<ContractName, ContractEnforcement>>>;
