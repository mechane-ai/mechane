import type { ContractEnforcement } from '@mechane/rule-shapes';

/** The words each README may hold outside code blocks, which the documents check counts. */
const VALUES = { documentWords: { 'README.md': 650, '.config/README.md': 450 } } as const;

/** What enforces `docs-readme-structure`. */
export const docsReadmeStructure = { values: VALUES, rules: [] } as const satisfies ContractEnforcement;
