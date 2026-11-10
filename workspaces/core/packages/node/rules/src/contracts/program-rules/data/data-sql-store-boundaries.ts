import { ADOPTED, AST_GREP_DEFAULTS, CRUISER_DEFAULTS, FileRole, RolloutPhase, RuleStatus } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/**
 * What enforces `data-sql-store-boundaries`: SQL text, statements and handles only in their owner's store, whose
 * records types its factories give.
 */
export const dataSqlStoreBoundaries = {
  values: {},
  rules: [
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'postgres-store-owner',
      comment: 'Keep PostgreSQL clients in the store owner, such as `runtime/src/store/database.ts`',
      from: { path: '^packages/', pathNot: '^packages/worker/control-store/src/store/' },
      to: { path: 'node_modules/pg/' },
      standard: 'DO-06',
    },
    {
      ...CRUISER_DEFAULTS,
      ...ADOPTED,
      name: 'postgres-context-private',
      comment: 'Keep transaction clients private to the store, such as `runInTransaction` for its callers',
      from: { path: '^packages/', pathNot: '^packages/worker/control-store/src/store/' },
      to: { path: '^packages/worker/control-store/src/store/context[.]ts$' },
      standard: 'DO-06',
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'sql-client-outside-store',
      standard: 'DO-06',
      violation: [
        'ctx.storage.sql.exec(statement);',
        'database.prepare(statement);',
        'context.client.query(statement);',
        'pool.query(statement);',
      ],
      allowed: ['turnStore.insertTurn({ turn });'],
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'sql-statement-not-literal',
      exemptRoles: [FileRole.BrowserCacheLifecycle, FileRole.SqlMigration, FileRole.LocalDatabaseLifecycle],
      maxSuppressions: 3,
      standard: 'DO-06',
      violation: [
        'sql.exec(statement);',
        "sql.exec('SELECT ' + column);",
        'context.client.query(statement);',
        "client.query('SELECT ' + column);",
      ],
      allowed: [
        "sql.exec('SELECT 1');",
        'database.prepare(`SELECT 1`);',
        "context.client.query('SELECT id FROM invoices WHERE id=$1', [id]);",
      ],
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'sql-text-outside-store',
      exemptRoles: [FileRole.LocalDatabaseLifecycle],
      standard: 'DO-06',
      violation: ["const statement = 'SELECT 1';"],
      allowed: ['const rows = turnStore.listTurns({ mechId });'],
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'store-handle-exposed',
      standard: 'DO-06',
      violation: ['function turnStore({ sql }: StoreInput) { return { sql, readTurn }; }'],
      allowed: ['function turnStore({ sql }: StoreInput) { return { readTurn }; }'],
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'records-type-inferred',
      standard: 'TD-04',
      status: RuleStatus.Ratchet,
      phase: RolloutPhase.DataShapes,
      violation: ['export type TurnRecords = { readonly turn: (input: TurnIdInput) => Option.Option<TurnRow> };'],
      allowed: ['export type TurnRecords = ReturnType<typeof turnRecords>;'],
    },
  ],
} as const satisfies ContractEnforcement;
