import { FixBehavior, Normalizer, NORMALIZER_DEFAULTS, RolloutPhase, RuleStatus } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** A tree the normalizer leaves as it is: a `break` and a one-line assignment in each case of a spaced `switch`. */
const SWITCH_CASES = {
  'scripts/size.ts':
    'export function size(kind: Kind): number {\n  let used = 0;\n\n  switch (kind) {\n    case Kind.Small:\n      used = 1;\n      break;\n    case Kind.Large:\n      used = 2;\n      break;\n  }\n\n  return used;\n}\n',
} as const;

/** A tree the normalizer leaves as it is: a function's overload signatures before its implementation. */
const OVERLOADS = {
  'scripts/parse.ts':
    'export function parse(text: string): number;\nexport function parse(text: ReadonlyArray<string>): ReadonlyArray<number>;\nexport function parse(text: string | ReadonlyArray<string>): number | ReadonlyArray<number> {\n  return 0;\n}\n',
} as const;

/** A tree the normalizer leaves as it is: a multi-line import, re-export and list of exported names. */
const NAME_LISTS = {
  'scripts/names.ts':
    "import {\n  first,\n  second,\n} from './first.ts';\nimport { third } from './third.ts';\nexport {\n  fourth,\n} from './fourth.ts';\nexport {\n  first,\n  second,\n  third,\n};\n",
} as const;

/**
 * What enforces `code-blank-lines`: the normalizer that inserts each blank line the contract asks for, and whose dry
 * run the checks require. An inserted line changes no bundle.
 */
export const codeBlankLines = {
  values: {},
  rules: [
    {
      ...NORMALIZER_DEFAULTS,
      name: Normalizer.BlankLines,
      behavior: FixBehavior.TypeOnly,
      rewrites: [
        {
          before: {
            'scripts/total.ts':
              'export function total(isDone: boolean): number {\n  const sum = 1;\n  if (isDone) {\n    return sum;\n  }\n  return 0;\n}\n',
          },
          after: {
            'scripts/total.ts':
              'export function total(isDone: boolean): number {\n  const sum = 1;\n\n  if (isDone) {\n    return sum;\n  }\n\n  return 0;\n}\n',
          },
        },
        {
          before: {
            'scripts/send.ts':
              'export function send(order: Order): string {\n  notify({ order });\n  void flush();\n  new Receipt({ order });\n  const sent = order.id;\n  return sent;\n}\n',
          },
          after: {
            'scripts/send.ts':
              'export function send(order: Order): string {\n  notify({ order });\n  void flush();\n  new Receipt({ order });\n\n  const sent = order.id;\n\n  return sent;\n}\n',
          },
        },
        {
          before: {
            'scripts/close.ts':
              'export function close(order: Order): string {\n  const id = order.id;\n  order.onClose?.(id);\n  return id;\n}\n',
          },
          after: {
            'scripts/close.ts':
              'export function close(order: Order): string {\n  const id = order.id;\n\n  order.onClose?.(id);\n\n  return id;\n}\n',
          },
        },
        {
          before: {
            'scripts/order.ts':
              "const LIMITS = {\n  lines: 3,\n};\nconst NAME = 'order';\nexport type Order = {\n  readonly id: string;\n};\n",
          },
          after: {
            'scripts/order.ts':
              "const LIMITS = {\n  lines: 3,\n};\n\nconst NAME = 'order';\n\nexport type Order = {\n  readonly id: string;\n};\n",
          },
        },
        {
          before: {
            'scripts/send-order.ts':
              "export const sendOrder = Effect.fn('sendOrder')(function* ({ order }: SendInput) {\n  yield* notify({ order });\n  yield* audit({ order });\n  const sent = order.id;\n  return sent;\n});\n",
          },
          after: {
            'scripts/send-order.ts':
              "export const sendOrder = Effect.fn('sendOrder')(function* ({ order }: SendInput) {\n  yield* notify({ order });\n  yield* audit({ order });\n\n  const sent = order.id;\n\n  return sent;\n});\n",
          },
        },
        {
          before: {
            'scripts/follow.ts':
              'export function follow(events: Events): void {\n  const count = events.length;\n  /** Writes one event. */\n  const writeEvent: (event: Event) => void = (event) => {\n    writeLine({ event, count });\n  };\n  events.forEach(writeEvent);\n}\n',
          },
          after: {
            'scripts/follow.ts':
              'export function follow(events: Events): void {\n  const count = events.length;\n\n  /** Writes one event. */\n  const writeEvent: (event: Event) => void = (event) => {\n    writeLine({ event, count });\n  };\n\n  events.forEach(writeEvent);\n}\n',
          },
        },
        { before: SWITCH_CASES, after: SWITCH_CASES },
        { before: OVERLOADS, after: OVERLOADS },
        { before: NAME_LISTS, after: NAME_LISTS },
      ],
      standard: 'EF-24',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
    },
  ],
} as const satisfies ContractEnforcement;
