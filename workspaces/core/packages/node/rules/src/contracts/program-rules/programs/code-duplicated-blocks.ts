import type { ContractEnforcement } from '@mechane/rule-shapes';

/** The smallest copied block jscpd reports, in tokens and lines. */
const CLONE = { cloneTokens: 50, cloneLines: 6 } as const;

/**
 * jscpd's configuration: the folders and formats it scans, what it skips, and a failure on any copy of the size. No
 * copy keeps a suppression, since jscpd cannot report one that covers no copy.
 */
const VALUES = {
  ...CLONE,
  jscpdSuppressions: 0,
  jscpd: {
    path: ['packages', 'lint'],
    format: ['typescript', 'javascript', 'yaml', 'json'],
    ignore: ['**/node_modules/**', '**/dist/**', '**/reference.json', 'lint/baseline/**'],
    minTokens: CLONE.cloneTokens,
    minLines: CLONE.cloneLines,
    maxLines: 1_000_000,
    maxSize: '100mb',
    threshold: 0,
    exitCode: 1,
    reporters: ['console'],
    gitignore: true,
  },
} as const;

/** What enforces `code-duplicated-blocks`: jscpd fails on any copied block of the declared size. */
export const codeDuplicatedBlocks = { values: VALUES, rules: [] } as const satisfies ContractEnforcement;
