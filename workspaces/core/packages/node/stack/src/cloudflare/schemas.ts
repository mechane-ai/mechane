import { Schema } from 'effect';

/** The runtime fields carried through Wrangler by its base configuration. */
export const RuntimeConfiguration = Schema.Struct({
  compatibility_date: Schema.String,
  compatibility_flags: Schema.Array(Schema.String),
  durable_objects: Schema.Struct({
    bindings: Schema.Array(Schema.Struct({ name: Schema.String, class_name: Schema.String })),
  }),
});

export type RuntimeConfiguration = typeof RuntimeConfiguration.Type;
