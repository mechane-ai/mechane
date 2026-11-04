import { FixBehavior, Lane, ManifestFamily, RolloutPhase, RuleFix, RuleStatus, RuleTool } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** The lanes and public entries a member may import, and the folders that hold its source. */
const VALUES = {
  laneImports: {
    [Lane.Shared]: [Lane.Shared],
    [Lane.Worker]: [Lane.Shared, Lane.Worker],
    [Lane.Node]: [Lane.Shared, Lane.Node],
    [Lane.Browser]: [Lane.Shared, Lane.Browser],
  },
  sourceFolders: ['src', 'scripts', '.storybook', 'vite.config.ts'],
  memberSourceFolders: { '@mechane-ai/ui': ['packages', 'vite.config.ts'] },
  libraryExports: { '.': './src/index.ts' },
  // StyleX imports resolve directly to their definition. The UI's other subpaths expose cohesive public modules.
  definitionExports: {
    '@mechane-ai/ui': {
      '.': './packages/core/src/index.ts',
      './tokens': './packages/core/src/tokens.stylex.ts',
      './tokens.stylex': './packages/core/src/tokens.stylex.ts',
      './layout': './packages/layout/src/index.ts',
      './collections': './packages/collections/src/index.ts',
      './content': './packages/content/src/index.ts',
      './content/link': './packages/content/src/link.ts',
      './content/code': './packages/content/src/code/index.ts',
      './content/diff': './packages/content/src/diff/index.ts',
      './content/tree': './packages/content/src/tree/index.ts',
      './ai': './packages/ai/src/index.ts',
      './charts': './packages/charts/src/index.ts',
      './charts/cartesian': './packages/charts/src/cartesian/index.ts',
      './charts/distribution': './packages/charts/src/distribution/index.ts',
      './charts/matrix': './packages/charts/src/matrix/index.ts',
      './charts/graph': './packages/charts/src/graph/index.ts',
      './styles.css': './packages/core/src/styles.css',
    },
  },
} as const;

/** A family of rules the member manifest generates, fixed by hand, which the packages phase turned on. */
const MANIFEST = {
  tool: RuleTool.Manifest,
  fix: RuleFix.Manual,
  behavior: FixBehavior.Restructure,
  status: RuleStatus.Enforced,
  phase: RolloutPhase.Packages,
} as const;

/**
 * What enforces `package-layers`: each member's layer, lane and consumers, each lane's runtime modules and each
 * confined package, from `dependencies.json`.
 */
export const packageLayers = {
  values: VALUES,
  rules: [
    {
      ...MANIFEST,
      name: ManifestFamily.Layer,
      comment:
        'Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`',
      standard: 'ST-02',
    },
    {
      ...MANIFEST,
      name: ManifestFamily.Lane,
      comment:
        "Import Node's modules only outside the shared lane and the Workers runtime's only in the worker lane, such as `node:path` in `@mechane/cli` and `cloudflare:workers` in `@mechane/mech`",
      standard: 'ST-02',
    },
    {
      ...MANIFEST,
      name: ManifestFamily.Confine,
      comment:
        'Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`',
      standard: 'ST-04',
    },
  ],
} as const satisfies ContractEnforcement;
