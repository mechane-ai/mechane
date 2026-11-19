import { Schema } from 'effect';
import { builtinName, WORKER_TOOLS } from './builtin-tools.ts';
import { ENABLED_FIELD, resolveSetting, TOOL_OVERRIDES, Toolsets } from './tool-settings.ts';
import type { ManagedToolSetting } from './tool-settings.ts';
import { resolveManagedWebOverride } from './web-configuration.ts';
import type { ManagedWebOverride } from './web-configuration.ts';
import { WEB_TOOLS_DISABLED } from './web-settings.ts';
import type { ManagedWebSettings } from './web-settings.ts';
import { checkWebSourceTools } from './web-sources.ts';

type Toolset = (typeof Toolsets.Type)[number];
type WireObject = Readonly<Record<string, unknown>>;

type ManagedBuiltin = ManagedToolSetting & {
  readonly name: ReturnType<typeof builtinName>;
  readonly type: ReturnType<typeof builtinName>;
} & ManagedWebOverride;

type Custom = Extract<Toolset, { readonly type: 'custom' }>;

type WorkerSet = {
  readonly type: 'agent_toolset_20260401';
  readonly [TOOL_OVERRIDES]: ReadonlyArray<ManagedBuiltin>;
  readonly default_config: ManagedToolSetting;
};

type McpOverride = ManagedToolSetting & { readonly name: string };

type McpSet = {
  readonly type: 'mcp_toolset';
  readonly mcp_server_name: string;
  readonly [TOOL_OVERRIDES]: ReadonlyArray<McpOverride>;
  readonly default_config: ManagedToolSetting;
};

type Resolved = Custom | WorkerSet | McpSet;
const DEFAULT_WORKER = { [ENABLED_FIELD]: true, permission_policy: { type: 'always_allow' } } as const;
const DEFAULT_MCP = { [ENABLED_FIELD]: true, permission_policy: { type: 'always_ask' } } as const;
const TOOLSET_MAX_ITEMS = 256;
const MCP_TOOL_NAME_MAX_CHARACTERS = 128;
const McpName = Schema.NonEmptyString.check(Schema.isMaxLength(MCP_TOOL_NAME_MAX_CHARACTERS));

const CustomInput = Schema.StructWithRest(
  Schema.Struct({
    type: Schema.Literal('object'),
    properties: Schema.optional(Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown))),
    required: Schema.optional(Schema.NullOr(Schema.Array(Schema.String))),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);

export function checkManagedToolNames(names: ReadonlyArray<string>): void {
  if (names.length > TOOLSET_MAX_ITEMS) {
    throw new Error('A session can offer at most 256 tools');
  }

  unique(names);
}

function unique(names: Iterable<string>): void {
  const seen = new Set<string>();

  for (const name of names) {
    if (seen.has(name)) {
      throw new Error('Tool names and toolsets must be unique');
    }

    seen.add(name);
  }
}

function builtinOverride(value: WireObject, defaults: ManagedToolSetting, web: ManagedWebSettings): ManagedBuiltin {
  const name = builtinName(value['name']);

  if (value['type'] !== undefined && value['type'] !== name) {
    throw new Error('Tool type must match its name');
  }

  const setting = resolveSetting(value, defaults);
  const override = { type: name, name, ...setting };

  switch (name) {
    case 'web_fetch':
    case 'web_search':
      return { ...override, ...resolveManagedWebOverride({ name, value, isEnabled: setting.enabled, settings: web }) };
    case 'bash':
    case 'edit':
    case 'glob':
    case 'grep':
    case 'read':
    case 'write':
      return override;
  }
}

function resolveDeclaration(declaration: Toolset, web: ManagedWebSettings): Resolved {
  switch (declaration.type) {
    case 'custom':
      return { ...declaration, input_schema: Schema.decodeUnknownSync(CustomInput)(declaration.input_schema) };
    case 'agent_toolset_20260401': {
      const defaults = resolveSetting(declaration.default_config, DEFAULT_WORKER);
      const overrides = (declaration.configs ?? []).map((value) => builtinOverride(value, defaults, web));

      unique(overrides.map((value) => value.name));

      return { type: declaration.type, default_config: defaults, [TOOL_OVERRIDES]: overrides };
    }
    case 'mcp_toolset': {
      const defaults = resolveSetting(declaration.default_config, DEFAULT_MCP);

      const overrides = (declaration.configs ?? []).map((value) => ({
        name: Schema.decodeUnknownSync(McpName)(value['name']),
        ...resolveSetting(value, defaults),
      }));

      unique(overrides.map((value) => value.name));

      return {
        type: declaration.type,
        mcp_server_name: declaration.mcp_server_name,
        default_config: defaults,
        [TOOL_OVERRIDES]: overrides,
      };
    }
  }
}

function effectiveNames(declaration: Resolved): ReadonlyArray<string> {
  switch (declaration.type) {
    case 'custom':
      return [declaration.name];
    case 'mcp_toolset':
      return [];
    case 'agent_toolset_20260401':
      return WORKER_TOOLS.filter((name) => {
        const override = declaration.configs.find((entry) => entry.name === name);

        return (override ?? declaration.default_config).enabled;
      });
  }
}

export function resolveManagedToolsets(
  value: unknown,
  web: ManagedWebSettings = WEB_TOOLS_DISABLED,
): ReadonlyArray<Resolved> {
  if (value === undefined) {
    return [];
  }

  const entries = Schema.decodeUnknownSync(Toolsets)(value);
  const declarations = entries.map((entry) => resolveDeclaration(entry, web));

  checkManagedToolNames(declarations.flatMap(effectiveNames));
  unique(declarations.filter((entry) => entry.type === 'mcp_toolset').map((entry) => entry.mcp_server_name));

  const builtins = declarations.filter((entry) => entry.type === 'agent_toolset_20260401');

  if (builtins.length > 1) {
    throw new Error('The built-in toolset can be declared once');
  }

  const sources = builtins[0]?.configs.find((entry) => entry.name === 'web_fetch')?.url_sources;

  if (sources !== undefined && sources !== null) {
    const customNames = new Set(declarations.filter((entry) => entry.type === 'custom').map((entry) => entry.name));

    checkWebSourceTools(sources, customNames);
  }

  return declarations;
}
