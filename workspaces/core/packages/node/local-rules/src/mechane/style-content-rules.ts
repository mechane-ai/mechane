import { AST_GREP_DEFAULTS, RolloutPhase, RuleStatus } from '@mechane/rule-shapes';

/**
 * The rules of what `code-style` writes inside a function. Loops are named steps and failures tagged errors, while
 * numbers come from their units and HTTP words from their sets.
 */
export const STYLE_CONTENT_RULES = [
  {
    ...AST_GREP_DEFAULTS,
    name: 'dense-loop',
    standard: 'SC-08',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.EffectDialect,
    violation: [
      'for (const table of tables) { while (Option.isSome(next)) { next = copyPage({ table }); } }',
      'while (true) { step(); }',
      'for (const file of files) { offset += 1; }',
      'for (const item of items) { seen.add(item); }',
      'function seenItems({ items }: SeenInput): ReadonlySet<Item> { const seen = new Set<Item>(); for (const item of items) { seen.add(item); } return seen; }',
      "function words({ lines }: WordsInput): ReadonlyArray<string> { const found: Array<string> = []; const collect: (line: string) => void = (line) => { for (const word of line.split(' ')) { found.push(word); } }; lines.forEach(collect); return found; }",
      "function seenWords({ lines }: WordsInput): ReadonlySet<string> { const seen = new Set<string>(); const collect: (line: string) => void = (line) => { for (const word of line.split(' ')) { seen.add(word); } }; lines.forEach(collect); return seen; }",
      'function fill({ holder, lines }: FillInput): void { const { found } = holder; for (const line of lines) { found.push(line); } }',
    ],
    allowed: [
      'for (const table of tables) { await copyTable({ table }); }',
      'const seen = new Set(items);',
      "function itemCache(): ItemCache { const seen = new Set<Item>(); const remember: ItemCache['remember'] = ({ items }) => { for (const item of items) { seen.add(item); } }; return { remember }; }",
    ],
  },
  {
    ...AST_GREP_DEFAULTS,
    name: 'untyped-failure',
    standard: 'SC-09',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.DataShapes,
    violation: [
      'return Promise.reject(new MachineStopped({ machineId }));',
      'const row = Option.getOrThrowWith(found, () => new RowMissing({ mechId }));',
      "const failure = new CredentialsFailed({ operation: 'write the key file', reason: String(cause) });",
    ],
    allowed: [
      'return Result.fail(new LauncherRefused({ machineId, status, reason }));',
      'const failure = new CredentialsFailed({ step: CredentialsStep.WriteKeyFile, path, reason: String(cause) });',
    ],
  },
  {
    ...AST_GREP_DEFAULTS,
    name: 'unit-number',
    standard: 'SC-11',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.Time,
    violation: [
      'const SANDBOX_IDLE_MS = 900_000;',
      'const PACK_CHUNK_BYTES = 5 * 1024 ** 2;',
      'const HOLD = Duration.millis(30_000);',
      'const CLI_TIMEOUT = Duration.seconds(60);',
      'const WORK = Duration.minutes(120);',
    ],
    allowed: [
      'const SANDBOX_IDLE = Duration.minutes(15);',
      'const ALARM_WORK = Duration.seconds(90);',
      'const OUTPUT_TAIL_BYTES = 50 * BYTES_PER_KIBIBYTE;',
      'const HEALTH_INTERVAL_MS = 500;',
    ],
  },
  {
    ...AST_GREP_DEFAULTS,
    name: 'http-literal',
    standard: 'SC-12',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.DataShapes,
    violation: [
      "const headers = { 'content-type': 'application/json' };",
      'const FAMILY_STATUS = { NotFound: 404 };',
      'const expected = { expectedStatus: 404 };',
      "const READ_METHODS = { probe: 'HEAD' };",
    ],
    allowed: [
      'const headers = { [HttpHeader.ContentType]: MediaType.Json };',
      'const FAMILY_STATUS = { NotFound: HttpStatusCode.NotFound };',
      'const expected = { expectedStatus: HttpStatusCode.NotFound };',
      "const ref = { branch: 'HEAD' };",
    ],
  },
] as const;
