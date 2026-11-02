import type { ContractEnforcement, ContractName } from '@mechane/rule-shapes';
import { ciCheckTrust } from './ci-check-trust.ts';
import { ciReproducibleChecks } from './ci-reproducible-checks.ts';
import { contextAgentInstructionFiles } from './context-agent-instruction-files.ts';
import { contextNoteCuration } from './context-note-curation.ts';
import { contractMaintenance } from './contract-maintenance.ts';
import { docsProseStyle } from './docs-prose-style.ts';
import { docsReadmeStructure } from './docs-readme-structure.ts';
import { testAssertionIntegrity } from './test-assertion-integrity.ts';
import { testCuration } from './test-curation.ts';

/** The registry's entry for each contract of the factory's contracts, in the order of their folders. */
export const FACTORY_CONTRACTS = {
  'test-curation': testCuration,
  'test-assertion-integrity': testAssertionIntegrity,
  'ci-reproducible-checks': ciReproducibleChecks,
  'ci-check-trust': ciCheckTrust,
  'contract-maintenance': contractMaintenance,
  'context-note-curation': contextNoteCuration,
  'context-agent-instruction-files': contextAgentInstructionFiles,
  'docs-prose-style': docsProseStyle,
  'docs-readme-structure': docsReadmeStructure,
} as const satisfies Readonly<Partial<Record<ContractName, ContractEnforcement>>>;
