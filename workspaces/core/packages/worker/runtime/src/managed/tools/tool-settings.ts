import { Schema } from 'effect';

export const TOOL_OVERRIDES = 'configs';
export const ENABLED_FIELD = 'enabled';
const SERVER_NAME_MAX_CHARACTERS = 255;

const Policy = Schema.Struct({ type: Schema.Literals(['always_allow', 'always_ask', 'auto']) });
export type ManagedPermission = typeof Policy.Type.type;

const Setting = Schema.Struct({
  enabled: Schema.optional(Schema.NullOr(Schema.Boolean)),
  permission_policy: Schema.optional(Schema.NullOr(Policy)),
});

const ObjectFields = Schema.Record(Schema.String, Schema.Unknown);
const OptionalSettings = Schema.optional(Schema.NullOr(ObjectFields));
const Overrides = Schema.optional(Schema.Array(ObjectFields));

export const Toolsets = Schema.Array(
  Schema.Union([
    Schema.Struct({
      type: Schema.Literal('agent_toolset_20260401'),
      [TOOL_OVERRIDES]: Overrides,
      default_config: OptionalSettings,
    }),
    Schema.Struct({
      type: Schema.Literal('mcp_toolset'),
      mcp_server_name: Schema.NonEmptyString.check(Schema.isMaxLength(SERVER_NAME_MAX_CHARACTERS)),
      [TOOL_OVERRIDES]: Overrides,
      default_config: OptionalSettings,
    }),
    Schema.Struct({
      type: Schema.Literal('custom'),
      name: Schema.String.check(Schema.isPattern(/^[a-zA-Z0-9_-]{1,128}$/u)),
      description: Schema.NonEmptyString,
      input_schema: ObjectFields,
    }),
  ]),
);

export type ManagedToolSetting = {
  readonly [ENABLED_FIELD]: NonNullable<typeof Setting.Type.enabled>;
  readonly permission_policy: typeof Policy.Type;
};

export function resolveSetting(value: unknown, base: ManagedToolSetting): ManagedToolSetting {
  const setting = Schema.decodeUnknownSync(Setting)(value ?? {});

  return {
    enabled: setting.enabled ?? base.enabled,
    permission_policy: setting.permission_policy ?? base.permission_policy,
  };
}
