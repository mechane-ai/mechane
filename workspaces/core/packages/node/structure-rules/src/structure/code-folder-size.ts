import { ADOPTED, FixBehavior, OWNED_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/**
 * The files of one extension a folder may hold directly, its TypeScript role and fixed files aside, and the folder
 * levels below a source root.
 */
const VALUES = { folderFiles: 12, folderDepth: 3 } as const;

/** What enforces `code-folder-size`: the layout check reads both limits. */
export const codeFolderSize = {
  values: VALUES,
  rules: [
    {
      ...OWNED_DEFAULTS,
      name: 'layout',
      behavior: FixBehavior.BindingNames,
      standard: 'ST-15',
      violation: [{ 'packages/node/stack/src/a/b/c/d/e.ts': 'export const e = 1;\n' }],
      allowed: [{ 'packages/node/stack/src/a/b/c/d.ts': 'export const d = 1;\n' }],
      ...ADOPTED,
    },
  ],
} as const satisfies ContractEnforcement;
