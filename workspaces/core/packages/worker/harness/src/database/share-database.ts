import { SqliteStorage } from '@earendil-works/pi-durable/storage/sqlite';
import { DurableObjectSqliteDatabase } from '@earendil-works/pi-durable/storage/sqlite/cloudflare';
import type { SharedDatabase } from '../types.ts';

/** The prefix of pi's tables in a mech's database; a new prefix moves no stored data, so it is a stored format. */
const PI_TABLE_PREFIX = 'pi_';

type ShareDatabaseInput = { readonly storage: DurableObjectStorage };

/**
 * The mech's one SQLite client, through which pi's storage and the mech's store both reach the database. So their
 * transactions queue one behind the other, while a statement made beside it could join an open pi transaction and roll
 * back with it.
 */
export function shareDatabase({ storage }: ShareDatabaseInput): SharedDatabase {
  const database = new DurableObjectSqliteDatabase(storage);

  const transaction: SharedDatabase['transaction'] = ({ run }) => database.transaction(async () => run());

  return { transaction, openPiStorage: () => SqliteStorage.open(database, { prefix: PI_TABLE_PREFIX }) };
}
