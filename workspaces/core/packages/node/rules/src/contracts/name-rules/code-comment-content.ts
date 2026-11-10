import { FixBehavior, OWNED_DEFAULTS, RolloutPhase, RuleStatus } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** The sentences a doc comment may hold, and the words each may hold. */
const VALUES = {
  docSentences: 3,
  docSentenceWords: 30,
  publicEntrypoints: [
    'packages/shared/client/src/index.ts',
    'packages/shared/client/src/presentation/index.ts',
    'packages/shared/protocol/src/index.ts',
    'packages/shared/protocol/src/presentation/index.ts',
  ],
  componentFiles: ['packages/browser/**/*.tsx', 'packages/browser/elements/packages/**/*.{ts,tsx}'],
} as const;

/** Public entrypoints own caller documentation; every authored comment retains the same quality limits. */
export const codeCommentContent = {
  values: VALUES,
  rules: [
    {
      ...OWNED_DEFAULTS,
      name: 'export-doc',
      behavior: FixBehavior.TypeOnly,
      standard: 'CD-03',
      violation: [
        { 'packages/shared/client/src/index.ts': 'export function call(): void {}\n' },
        {
          'packages/shared/client/src/index.ts': "export { call } from './call.ts';\n",
          'packages/shared/client/src/call.ts': 'export function call(): void {}\n',
        },
      ],
      allowed: [
        { 'packages/worker/runtime/src/execution/admit.ts': 'export function admit(): void {}\n' },
        { 'packages/browser/console-data/src/cache.ts': 'export const capacity = 3;\n' },
        {
          'packages/shared/client/src/index.ts': "export { call } from './call.ts';\n",
          'packages/shared/client/src/call.ts':
            '/** Decodes the operation result or reports its declared failure. */\nexport function call(): void {}\nexport const bufferSize = 3;\n',
        },
        {
          'packages/browser/elements/packages/core/src/title.tsx':
            'export function Title() { return <h1>Console</h1>; }\n',
        },
        {
          'packages/browser/elements/packages/foundations/src/tokens.stylex.ts':
            'export const colors = { surface: "white" };\n',
        },
        {
          'packages/shared/client/src/index.ts':
            '/** The mode a saved login keeps: read and write for its owner. */\n// oxlint-disable-next-line no-bitwise -- a file mode is a bit field\nexport const OWNER_MODE = 0o400 | 0o200;\n',
        },
      ],
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Docs,
    },
    {
      ...OWNED_DEFAULTS,
      name: 'absence-doc',
      behavior: FixBehavior.TypeOnly,
      standard: 'CD-04',
      violation: [
        {
          'packages/shared/protocol/src/index.ts': "export type { Run } from './runs.ts';\n",
          'packages/shared/protocol/src/runs.ts': 'export type Run = { readonly endedAt?: number };\n',
        },
        {
          'packages/shared/protocol/src/index.ts': "export { Run } from './runs.ts';\n",
          'packages/shared/protocol/src/runs.ts':
            'export const Run = Schema.Struct({ endedAt: Schema.NullOr(Schema.Number) });\n',
        },
      ],
      allowed: [
        {
          'packages/worker/runtime/src/execution/state.ts':
            'export type RunState = { readonly completedAt: number | null; readonly pending?: string };\n',
        },
        { 'packages/shared/client/src/index.ts': "export type { ChatOptions } from 'ai';\n" },
        {
          'packages/browser/elements/packages/core/src/control-state.ts':
            'export type ControlProps = { readonly value?: never; readonly defaultValue?: string };\n',
        },
        {
          'packages/shared/protocol/src/index.ts': "export type { Run } from './runs.ts';\n",
          'packages/shared/protocol/src/runs.ts':
            'export type Run = {\n  /** Absent until execution finishes. */\n  readonly endedAt?: number;\n};\ntype InternalState = { readonly retryAt?: number };\n',
        },
        {
          'packages/shared/protocol/src/index.ts': "export { Run } from './runs.ts';\n",
          'packages/shared/protocol/src/runs.ts':
            'export const Run = Schema.Struct({\n  /** Null until execution finishes. */\n  endedAt: Schema.NullOr(Schema.Number),\n});\n',
        },
      ],
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Docs,
    },
    {
      ...OWNED_DEFAULTS,
      name: 'short-doc',
      behavior: FixBehavior.TypeOnly,
      standard: 'CD-06',
      violation: [
        { 'scripts/start-stack.ts': '/** Start stack. */\nexport function startStack(): void {}\n' },
        {
          'packages/browser/elements/packages/core/src/title.tsx':
            '/** Title. */\nexport function Title() { return <h1>Console</h1>; }\n',
        },
      ],
      allowed: [
        {
          'scripts/start-stack.ts':
            '/** Starts the Worker and its GitHub on free ports. */\nexport function startStack(): void {}\n',
        },
      ],
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Docs,
    },
  ],
} as const satisfies ContractEnforcement;
