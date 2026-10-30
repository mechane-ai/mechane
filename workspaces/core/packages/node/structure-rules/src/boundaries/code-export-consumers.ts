import { PackageKind } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/**
 * How knip finds every export, file and dependency without a consumer, with each setting's reason, and a note for each
 * kind of member whose entries need one.
 */
const VALUES = {
  knip: {
    includeEntryExports: true,
    treatConfigHintsAsErrors: true,
    ignoreExportsUsedInFile: { type: true, interface: true },
    ignoreDependencies: ['@swc/core', 'cloudflare'],
    ignore: ['.dependency-cruiser.cjs'],
  },
  knipNotes: [
    {
      path: ['includeEntryExports'],
      lines: ['Every export of an entry file needs a consumer; `!` marks production files for `knip --production`.'],
    },
    {
      path: ['treatConfigHintsAsErrors'],
      lines: ['A stale ignore entry or entry pattern is a suppression that suppresses nothing, so it fails the check.'],
    },
    {
      path: ['ignoreExportsUsedInFile'],
      lines: ["A type that an exported declaration's signature uses counts as used by that declaration's consumers."],
    },
    {
      path: ['ignoreDependencies'],
      lines: [
        "dependency-cruiser loads swc to parse TypeScript, as .dependency-cruiser.cjs selects with `parser: 'swc'`; the",
        'Workers runtime provides `cloudflare:workers`, which no package installs.',
      ],
    },
    {
      path: ['ignore'],
      lines: [
        "The checks program loads the cruiser's configuration through dependency-cruiser's API, which knip cannot see,",
        'since the root that holds it holds no source.',
      ],
    },
    {
      path: ['workspaces'],
      lines: [
        "Each member's workspace follows from its kind and source roots, so a new member is checked like the others.",
      ],
    },
  ],
  kindNotes: {
    [PackageKind.Program]: [
      'A program exports nothing: its `src/main.ts`, and the `bin` its manifest names, are its entries.',
    ],
    [PackageKind.App]: ["knip's Wrangler plugin reads `main` from wrangler.jsonc, the file the Workers runtime loads."],
  },
} as const;

/** What enforces `code-export-consumers`: knip's settings and each member's entries and project files. */
export const codeExportConsumers = { values: VALUES, rules: [] } as const satisfies ContractEnforcement;
