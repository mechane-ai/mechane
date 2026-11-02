import type { ContractEnforcement } from '@mechane/rule-shapes';

/** The words `AGENTS.md` may hold, which the documents check counts. */
const VALUES = { documentWords: { 'AGENTS.md': 500 } } as const;

/** What enforces `context-agent-instruction-files`. */
export const contextAgentInstructionFiles = { values: VALUES, rules: [] } as const satisfies ContractEnforcement;
