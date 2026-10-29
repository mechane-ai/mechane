import {
  ADOPTED,
  CRUISER_DEFAULTS,
  FixBehavior,
  Normalizer,
  NORMALIZER_DEFAULTS,
  RolloutPhase,
  RuleStatus,
} from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** How dependency-cruiser resolves and parses imports for every rule of its one cruise, with each option's reason. */
const VALUES = {
  cruiserOptions: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^packages/[^/]+/[^/]+/dist/' },
    parser: 'swc',
    combinedDependencies: true,
    preserveSymlinks: false,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      mainFields: ['module', 'main', 'types'],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
  cruiserNotes: [
    {
      path: ['options', 'exclude'],
      lines: [
        'Only built bundles leave the graph; npm packages stay in it as leaves, so the rules on npm imports apply.',
      ],
    },
    {
      path: ['options', 'parser'],
      lines: [
        'TypeScript 7 publishes no compiler API yet, so swc parses the sources; it keeps type-only imports as edges.',
      ],
    },
  ],
} as const;

/** A dependency-cruiser rule enforced before the standard. */
const CRUISER = { ...CRUISER_DEFAULTS, ...ADOPTED } as const;

/**
 * What enforces `code-typescript-module-boundaries`: an acyclic file graph of resolvable imports, and the barrel
 * normalizer that points each import at its declaring file.
 */
export const codeTypescriptModuleBoundaries = {
  values: VALUES,
  rules: [
    {
      ...CRUISER,
      name: 'no-circular',
      comment:
        'Break the cycle by moving what both files share into a file of its own, such as `session/types.ts`; type-only and dynamic imports count as edges',
      from: {},
      to: { circular: true },
      standard: 'ST-07',
    },
    {
      ...CRUISER,
      name: 'not-to-unresolvable',
      comment: 'Import a file that exists or a declared package, such as `./store.ts` or `effect`',
      from: {},
      to: { couldNotResolve: true, pathNot: '^cloudflare:' },
      standard: '004',
    },
    {
      ...NORMALIZER_DEFAULTS,
      name: Normalizer.Barrels,
      behavior: FixBehavior.BindingNames,
      rewrites: [
        {
          before: {
            'packages/node/stack/src/drones/count-drones.ts':
              'export function countDrones(): number {\n  return 1;\n}\n',
            'packages/node/stack/src/drones/index.ts': "export { countDrones } from './count-drones.ts';\n",
            'packages/node/stack/src/start-stack.ts':
              "import { countDrones } from './drones/index.ts';\n\nexport function startStack(): number {\n  return countDrones();\n}\n",
          },
          after: {
            'packages/node/stack/src/drones/count-drones.ts':
              'export function countDrones(): number {\n  return 1;\n}\n',
            'packages/node/stack/src/start-stack.ts':
              "import { countDrones } from './drones/count-drones.ts';\n\nexport function startStack(): number {\n  return countDrones();\n}\n",
          },
        },
        {
          before: {
            'packages/shared/protocol/src/index.ts': "export { countTurns } from './turns/count-turns.ts';\n",
            'packages/shared/protocol/src/turns/count-turns.ts':
              'export function countTurns(): number {\n  return 1;\n}\n',
            'packages/shared/protocol/scripts/print-turns.ts':
              "import { countTurns } from '../src/index.ts';\n\nexport function printTurns(): string {\n  return String(countTurns());\n}\n",
          },
          after: {
            'packages/shared/protocol/src/index.ts': "export { countTurns } from './turns/count-turns.ts';\n",
            'packages/shared/protocol/src/turns/count-turns.ts':
              'export function countTurns(): number {\n  return 1;\n}\n',
            'packages/shared/protocol/scripts/print-turns.ts':
              "import { countTurns } from '../src/turns/count-turns.ts';\n\nexport function printTurns(): string {\n  return String(countTurns());\n}\n",
          },
        },
      ],
      standard: 'ST-09',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
    },
  ],
} as const satisfies ContractEnforcement;
