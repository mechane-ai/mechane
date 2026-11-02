import { AST_GREP_DEFAULTS, RolloutPhase, RuleStatus } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/**
 * What enforces `code-numeric-literals`: a name for every number but -1, 0 and 1, a span or byte size named in its unit
 * as SC-11 says.
 */
export const codeNumericLiterals = {
  values: {},
  rules: [
    {
      ...AST_GREP_DEFAULTS,
      name: 'magic-number',
      standard: 'SC-11',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.Fixers,
      violation: [
        'function wait() { return Duration.seconds(30); }',
        "export const pause = Effect.fn('pause')(function* () { yield* Effect.sleep(Duration.millis(250)); });",
        'const READ_MAX_LINES = TEXT_MAX_BYTES + 4;',
        'const RULE = { to: rolePath({ roles: ROLES.slice(2) }) };',
        'function chunk() { return new Uint8Array(5 * BYTES_PER_MEBIBYTE); }',
        'function retry({ attempts = 3 }: RetryInput): void { run({ attempts }); }',
        'type Box = { readonly size: 7 };',
        'const AREA = WIDTH * 3 * 4;',
        'function migrate() { const maximumRows = 10_000; consume(maximumRows); }',
        'export const HANDLERS: ReadonlyArray<Handler> = [() => { const maximumRows = 10_000; consume(maximumRows); }];',
        'export const MIGRATIONS: ReadonlyArray<Migration> = [() => { if (rows > 10_000) refuse(); }];',
        'export const MIGRATIONS: ReadonlyArray<Migration> = [() => { let maximumRows = 10_000; consume(maximumRows); }];',
        'export const MIGRATIONS: ReadonlyArray<Migration> = [() => { const maximumRows = 10_000 * 2; consume(maximumRows); }];',
        'export const MIGRATIONS: ReadonlyArray<Migration> = [() => { later(() => { const maximumRows = 10_000; consume(maximumRows); }); }];',
      ],
      allowed: [
        'const RETRY_LIMIT = 3;',
        'const WAIT = Duration.seconds(30);',
        'const STARTUP_TIMEOUT = { host: Duration.seconds(90) } as const;',
        'function third({ items }) { return { first: items[2], step: 4 }; }',
        'function last({ items }) { return items.at(-1); }',
        'const OUTPUT_TAIL_BYTES = 50 * BYTES_PER_KIBIBYTE;',
        'type Port = 80 | 443;',
        'export const MIGRATIONS: ReadonlyArray<Migration> = [({ sql }) => { const maximumRows = 10_000; const countedRows = maximumRows + 1; const IdentityMigrationCounts = Schema.Struct({ identities: Schema.Int.check(Schema.isLessThanOrEqualTo(maximumRows)), sessions: Schema.Int.check(Schema.isLessThanOrEqualTo(maximumRows)) }); const cursor = sql.exec(statement, countedRows, countedRows); decodeOne({ cursor, schema: IdentityMigrationCounts }); }];',
        'export const MIGRATIONS: ReadonlyArray<Migration> = [function ({ sql }) { const minimumOffset = -3; sql.exec(statement, minimumOffset); }];',
      ],
    },
  ],
} as const satisfies ContractEnforcement;
