import type { ContractEnforcement, ContractName } from '@mechane/rule-shapes';
import { cliCommandReferenceGeneration } from './cli-command-reference-generation.ts';
import { cliOutputChannels } from './cli-output-channels.ts';
import { codeDiagnosticMessages } from './code-diagnostic-messages.ts';
import { codeDuplicatedBlocks } from './code-duplicated-blocks.ts';
import { codeEnvironmentSettings } from './code-environment-settings.ts';
import { codeExecutionLifecycle } from './code-execution-lifecycle.ts';
import { codeScriptEntryPoints } from './code-script-entry-points.ts';
import { codeSharedDefinitions } from './code-shared-definitions.ts';
import { codeSharedUtilities } from './code-shared-utilities.ts';

/** The registry's entry for each contract of the shared code and programs section, in the order of their folders. */
export const PROGRAM_CONTRACTS = {
  'code-duplicated-blocks': codeDuplicatedBlocks,
  'code-shared-definitions': codeSharedDefinitions,
  'code-shared-utilities': codeSharedUtilities,
  'code-environment-settings': codeEnvironmentSettings,
  'code-script-entry-points': codeScriptEntryPoints,
  'code-diagnostic-messages': codeDiagnosticMessages,
  'code-execution-lifecycle': codeExecutionLifecycle,
  'cli-command-reference-generation': cliCommandReferenceGeneration,
  'cli-output-channels': cliOutputChannels,
} as const satisfies Readonly<Partial<Record<ContractName, ContractEnforcement>>>;
