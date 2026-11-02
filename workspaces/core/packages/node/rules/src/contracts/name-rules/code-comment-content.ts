import { FixBehavior, OWNED_DEFAULTS, RolloutPhase, RuleStatus } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** The sentences a doc comment may hold, and the words each may hold. */
const VALUES = { docSentences: 3, docSentenceWords: 30 } as const;

/** What enforces `code-comment-content`: the limits the short-doc ratchet reads. */
export const codeCommentContent = {
  values: VALUES,
  rules: [
    {
      ...OWNED_DEFAULTS,
      name: 'export-doc',
      behavior: FixBehavior.TypeOnly,
      standard: 'CD-03',
      violation: [{ 'scripts/limits.ts': 'export const TURN_LIMIT = 3;\n' }],
      allowed: [
        { 'scripts/limits.ts': '/** The most turns a mech runs at once. */\nexport const TURN_LIMIT = 3;\n' },
        {
          'scripts/modes.ts':
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
      violation: [{ 'scripts/types.ts': 'export type Turn = { readonly endedAt?: number };\n' }],
      allowed: [
        {
          'scripts/types.ts':
            'export type Turn = {\n  /** Absent until the turn ends. */\n  readonly endedAt?: number;\n};\n',
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
      violation: [{ 'scripts/start-stack.ts': '/** Start stack. */\nexport function startStack(): void {}\n' }],
      allowed: [
        {
          'scripts/start-stack.ts':
            '/** Starts the Worker and its GitHub on free ports. */\nexport function startStack(): void {}\n',
        },
      ],
      status: RuleStatus.Ratchet,
      phase: RolloutPhase.Docs,
    },
  ],
} as const satisfies ContractEnforcement;
