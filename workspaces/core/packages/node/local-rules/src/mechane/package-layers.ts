import { FixBehavior, Lane, ManifestFamily, RolloutPhase, RuleFix, RuleStatus, RuleTool } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** The lanes each lane's members import, and a member's folders that hold its source. */
const VALUES = {
  laneImports: {
    [Lane.Shared]: [Lane.Shared],
    [Lane.Worker]: [Lane.Shared, Lane.Worker],
    [Lane.Node]: [Lane.Shared, Lane.Node],
  },
  sourceFolders: ['src', 'scripts'],
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
