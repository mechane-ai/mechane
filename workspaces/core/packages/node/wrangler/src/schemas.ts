import { Schema } from 'effect';

/**
 * The `containers` entries with only the keys celld accepts, which deploy.rs lists. The stack decodes them with every
 * other key refused, so a key only Cloudflare reads fails the smoke, whose host stack drops the entries.
 */
const ContainerEntries = Schema.Array(
  Schema.Struct({
    class_name: Schema.String,
    image: Schema.String,
    name: Schema.optional(Schema.String),
    instance_type: Schema.optional(Schema.String),
    max_instances: Schema.optional(Schema.Int),
    runtime: Schema.optional(Schema.String),
  }),
);

/**
 * A Durable Object migration of the Wrangler configuration with every key it holds, so two releases compare it whole;
 * the stack reads the classes it adds.
 */
const WranglerMigration = Schema.StructWithRest(
  Schema.Struct({ tag: Schema.String, new_sqlite_classes: Schema.Array(Schema.String) }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);

/** The Durable Object migrations of a Wrangler configuration, which a release may only append to. */
export const WranglerMigrations = Schema.Struct({ migrations: Schema.Array(WranglerMigration) });

export type WranglerMigrations = typeof WranglerMigrations.Type;

/**
 * The Wrangler configuration that celld and Cloudflare both deploy: the Worker's name, its variables, migrations,
 * containers and R2 buckets. A staged or rendered copy keeps every other key unchanged.
 */
export const BaseConfiguration = Schema.StructWithRest(
  Schema.Struct({
    name: Schema.String,
    vars: Schema.Record(Schema.String, Schema.String),
    migrations: WranglerMigrations.fields.migrations,
    containers: ContainerEntries,
    r2_buckets: Schema.Array(Schema.Struct({ binding: Schema.String, bucket_name: Schema.String })),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);

export type BaseConfiguration = typeof BaseConfiguration.Type;
