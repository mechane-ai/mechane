import { Schema } from 'effect';

/** The operator's account, as Cloudflare's API reads it with the token. */
export const CloudflareAccount = Schema.Struct({
  success: Schema.Literal(true),
  result: Schema.Struct({ name: Schema.String }),
});

export type CloudflareAccount = typeof CloudflareAccount.Type;

/** The account's Worker scripts, each by its name. */
export const ScriptList = Schema.Struct({
  success: Schema.Literal(true),
  result: Schema.Array(Schema.Struct({ id: Schema.String })),
});

export type ScriptList = typeof ScriptList.Type;
