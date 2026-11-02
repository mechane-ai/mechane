import { ADOPTED, FixBehavior, OWNED_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/**
 * The words a sentence may hold, and the sentences a paragraph may hold, in every budgeted document and in each
 * document no word budget bounds, such as the runbook.
 */
const VALUES = { sentenceWords: 30, paragraphSentences: 5, unbudgetedDocuments: ['.config/runbook.md'] } as const;

/** What enforces `docs-prose-style`. */
export const docsProseStyle = {
  values: VALUES,
  rules: [
    {
      ...OWNED_DEFAULTS,
      name: 'documents',
      behavior: FixBehavior.TypeOnly,
      standard: 'CD-08',
      violation: [{ 'AGENTS.md': `# Agents\n\n${'Run the check '.repeat(VALUES.sentenceWords)}push.\n` }],
      allowed: [{ 'AGENTS.md': '# Agents\n\nRun the check before each commit.\n' }],
      ...ADOPTED,
    },
  ],
} as const satisfies ContractEnforcement;
