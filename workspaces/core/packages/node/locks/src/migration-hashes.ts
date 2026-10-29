import { decodeFile, readText } from '@mechane/checks-kernel';
import type { InputUnreadable } from '@mechane/checks-kernel';
import { sha256Hex } from '@mechane/program';
import type { Lock } from '@mechane/program';
import { DurableObjectClass } from '@mechane/protocol';
import { Effect, Record, Schema } from 'effect';
import { storeHashes } from './store-hashes.ts';

/**
 * The migrations file of each Durable Object class's store, which lists its schema steps as `MIGRATIONS`. The migration
 * lock keys a store's steps by its class, so a move of the file keeps its entries.
 */
const STORE_MIGRATIONS = {
  [DurableObjectClass.Directory]: 'packages/worker/directory-store/src/migrations.ts',
  [DurableObjectClass.Workspace]: 'packages/worker/workspace-store/src/migrations.ts',
  [DurableObjectClass.Mech]: 'packages/worker/mech-store/src/migrations.ts',
  [DurableObjectClass.Sandbox]: 'packages/worker/sandbox-store/src/migrations.ts',
  [DurableObjectClass.Limiter]: 'packages/worker/limiter-store/src/migrations.ts',
  [DurableObjectClass.KeyCache]: 'packages/worker/key-cache-store/src/migrations.ts',
} as const satisfies Readonly<Record<DurableObjectClass, string>>;

/** The Wrangler configuration whose `migrations` add and rename the Durable Object classes. */
const WRANGLER_CONFIGURATION = 'packages/worker/app/wrangler.jsonc';

/** The migration lock's key for the Wrangler migrations, each under its position, its tag and its entry's hash. */
const WRANGLER_KEY = 'wrangler';

/** One of the Wrangler configuration's migrations, under its tag. */
const WranglerMigration = Schema.StructWithRest(Schema.Struct({ tag: Schema.String }), [
  Schema.Record(Schema.String, Schema.Unknown),
]);

type WranglerMigration = typeof WranglerMigration.Type;

/** The Wrangler configuration's migrations. */
const WranglerMigrations = Schema.Struct({ migrations: Schema.Array(WranglerMigration) });

/** A store's class, and the entry of each of its schema steps. */
type StoreEntry = readonly [string, ReadonlyArray<string>];

type StoreEntryInput = { readonly objectClass: DurableObjectClass; readonly path: string };

/**
 * Each schema step that will run in production, as the source declares it now. A store's `MIGRATIONS` entry stands
 * under its class by its position and the hash of what it does, and a Wrangler migration by its position, tag and hash.
 * An inserted or reordered step so fails as one the lock lost.
 */
export const migrationHashes = Effect.fn('migrationHashes')(function* (): Effect.fn.Return<Lock, InputUnreadable> {
  const stores = yield* Effect.forEach(
    Record.toEntries(STORE_MIGRATIONS),
    ([objectClass, path]) => storeEntry({ objectClass, path }),
    { concurrency: 1 },
  );

  const { migrations } = yield* decodeFile({ path: WRANGLER_CONFIGURATION, schema: WranglerMigrations });

  /** A Wrangler migration's entry: its position, its tag and the hash of the whole entry. */
  const tagEntry: (migration: WranglerMigration, index: number) => string = (migration, index) =>
    `${index} ${migration.tag} ${sha256Hex({ contents: JSON.stringify(migration) })}`;

  return { ...Record.fromEntries(stores), [WRANGLER_KEY]: migrations.map(tagEntry) };
});

/** A store's class and the hashes of its steps. */
const storeEntry = Effect.fn('storeEntry')(function* ({
  objectClass,
  path,
}: StoreEntryInput): Effect.fn.Return<StoreEntry, InputUnreadable> {
  const text = yield* readText({ path });

  return [objectClass, storeHashes({ path, text })];
});
