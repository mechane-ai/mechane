import { Normalizer, NORMALIZER_DEFAULTS, OWNED_DEFAULTS, RolloutPhase, RuleStatus } from '@mechane/rule-shapes';

/**
 * The placement normalizer, which puts each declaration beside its users (ST-19), and the ratchet of each declaration
 * it leaves out of place, whose finding names what blocks the move.
 */
export const PLACEMENT_RULES = [
  {
    ...NORMALIZER_DEFAULTS,
    name: Normalizer.Placement,
    rewrites: [
      {
        before: {
          'packages/node/stack/src/types.ts': 'export type StackInput = { readonly folder: string };\n',
          'packages/node/stack/src/start-stack.ts':
            "import { join } from 'node:path';\nimport type { StackInput } from './types.ts';\n\nexport function startStack({ folder }: StackInput): string {\n  return join(folder, 'stack');\n}\n",
        },
        after: {
          'packages/node/stack/src/start-stack.ts':
            "import { join } from 'node:path';\n\ntype StackInput = { readonly folder: string };\n\nexport function startStack({ folder }: StackInput): string {\n  return join(folder, 'stack');\n}\n",
        },
      },
      {
        before: {
          'packages/node/stack/src/mechs/constants.ts': "export const MECH_PATH = '/mechs';\n",
          'packages/node/stack/src/mechs/index.ts': "export { MECH_PATH } from './constants.ts';\n",
          'packages/node/stack/src/start-stack.ts':
            "import { MECH_PATH } from './mechs/index.ts';\n\nexport function startStack(): string {\n  return MECH_PATH;\n}\n",
          'packages/node/stack/src/stop-stack.ts':
            "import { MECH_PATH } from './mechs/constants.ts';\n\nexport function stopStack(): string {\n  return MECH_PATH;\n}\n",
        },
        after: {
          'packages/node/stack/src/constants.ts': "export const MECH_PATH = '/mechs';\n",
          'packages/node/stack/src/start-stack.ts':
            "import { MECH_PATH } from './constants.ts';\n\nexport function startStack(): string {\n  return MECH_PATH;\n}\n",
          'packages/node/stack/src/stop-stack.ts':
            "import { MECH_PATH } from './constants.ts';\n\nexport function stopStack(): string {\n  return MECH_PATH;\n}\n",
        },
      },
    ],
    standard: 'ST-19',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.Fixers,
  },
  {
    ...OWNED_DEFAULTS,
    name: 'placement-blocked',
    standard: 'ST-19',
    violation: [
      {
        'packages/node/stack/src/types.ts':
          'type Folder = string;\n\nexport type StartInput = { readonly folder: Folder };\n\nexport type StopInput = { readonly folder: Folder };\n',
        'packages/node/stack/src/start-stack.ts':
          "import type { StartInput } from './types.ts';\n\nexport function startStack({ folder }: StartInput): string {\n  return folder;\n}\n",
        'packages/node/stack/src/stop-stack.ts':
          "import type { StopInput } from './types.ts';\n\nexport function stopStack({ folder }: StopInput): string {\n  return folder;\n}\n",
      },
      {
        'packages/node/stack/src/dev/constants.ts': "export const LOCAL_ORIGIN = 'http://localhost';\n",
        'packages/node/stack/src/dev/announce.ts':
          "import { LOCAL_ORIGIN } from './constants.ts';\n\nexport function announce(): string {\n  return LOCAL_ORIGIN;\n}\n",
      },
    ],
    allowed: [
      {
        'packages/node/stack/src/start-stack.ts':
          'type StartInput = { readonly folder: string };\n\nexport function startStack({ folder }: StartInput): string {\n  return folder;\n}\n',
      },
    ],
    status: RuleStatus.Ratchet,
    phase: RolloutPhase.Packages,
  },
] as const;
