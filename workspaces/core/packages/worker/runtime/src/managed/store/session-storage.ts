import {
  DurableObjectSqliteDatabase,
  openDurableObjectSqliteStorage,
} from '@earendil-works/pi-durable/storage/sqlite/cloudflare';
import type { DurableObjectSqliteStorage } from '@earendil-works/pi-durable/storage/sqlite/cloudflare';

const HEXADECIMAL_RADIX = 16;
const HEX_BYTE_WIDTH = 2;

type SchemaTable = { readonly name: string };

async function sessionPrefix(id: string): Promise<string> {
  if (id.length === 0) {
    throw new Error('A managed session requires a storage identity');
  }

  const bytes = new TextEncoder().encode(id);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const digestBytes = new Uint8Array(hash);

  const digest = Array.from(digestBytes, (byte) => byte.toString(HEXADECIMAL_RADIX).padStart(HEX_BYTE_WIDTH, '0')).join(
    '',
  );

  return `managed_${digest}_`;
}

export function createManagedSessionStorage(storage: DurableObjectSqliteStorage) {
  const database = new DurableObjectSqliteDatabase(storage);

  return {
    async open(id: string) {
      const prefix = await sessionPrefix(id);

      return await openDurableObjectSqliteStorage(storage, { prefix });
    },
    async erase(id: string): Promise<void> {
      const prefix = await sessionPrefix(id);

      await database.transaction(async (transaction) => {
        const tables = await transaction.all<SchemaTable>(
          "SELECT name FROM sqlite_schema WHERE type='table' AND substr(name,1,length(?))=? ORDER BY name",
          prefix,
          prefix,
        );

        for (const table of tables) {
          if (!table.name.startsWith(prefix) || !/^[A-Za-z0-9_]+$/u.test(table.name)) {
            throw new Error('Unexpected SQLite identifier in managed session storage');
          }

          await transaction.exec(`DROP TABLE "${table.name}"`);
        }
      });
    },
  };
}
