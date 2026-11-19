import { Predicate, Schema } from 'effect';

const SimpleSource = Schema.Literals(['all', 'none']);
const SourceSelection = Schema.Struct({ type: SimpleSource });
const URL_SOURCE_MAX_ITEMS = 128;
const TOOL_NAME_MAX_CHARACTERS = 128;
const serverTools: ReadonlySet<string> = new Set(['web_search', 'web_fetch']);

const Tool = Schema.Struct({
  type: Schema.Literal('tool_reference'),
  name: Schema.NonEmptyString.check(Schema.isMaxLength(TOOL_NAME_MAX_CHARACTERS)),
});

const SelectedTools = Schema.Struct({
  type: Schema.Literals(['only', 'except']),
  tools: Schema.Array(Tool).check(Schema.isMinLength(1), Schema.isMaxLength(URL_SOURCE_MAX_ITEMS)),
});

const ToolSource = Schema.Union([SimpleSource, SourceSelection, SelectedTools]);

const Sources = Schema.Struct({
  user_input: Schema.optional(Schema.NullOr(Schema.Union([SimpleSource, SourceSelection]))),
  client_tool_results: Schema.optional(Schema.NullOr(ToolSource)),
  server_tool_results: Schema.optional(Schema.NullOr(ToolSource)),
});

type ExplicitSource = typeof SourceSelection.Type | typeof SelectedTools.Type;

function normalizeSource(value: typeof ToolSource.Type | undefined | null): ExplicitSource | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string') {
    return { type: value };
  }

  if ('tools' in value && new Set(value.tools.map((tool) => tool.name)).size !== value.tools.length) {
    throw new Error('Web fetch URL source tool names must be distinct');
  }

  return value;
}

export function managedWebSources(raw: unknown) {
  if (raw === null || raw === undefined) {
    return null;
  }

  const sources = Schema.decodeUnknownSync(Sources, { onExcessProperty: 'error' })(raw);
  const server = normalizeSource(sources.server_tool_results);

  if (server !== null && 'tools' in server && server.tools.some((tool) => !serverTools.has(tool.name))) {
    throw new Error('Web fetch server URL sources must reference web_search or web_fetch');
  }

  return {
    user_input: normalizeSource(sources.user_input),
    client_tool_results: normalizeSource(sources.client_tool_results),
    server_tool_results: server,
  };
}

export function checkWebSourceTools(
  sources: ReturnType<typeof managedWebSources>,
  customNames: ReadonlySet<string>,
): void {
  const client = sources?.client_tool_results;

  if (Predicate.isNotNullish(client) && 'tools' in client && client.tools.some((tool) => !customNames.has(tool.name))) {
    throw new Error('Web fetch client URL sources must reference a custom tool in the same tools array');
  }
}
