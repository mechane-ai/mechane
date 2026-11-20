import { Schema } from 'effect';
import { ManagedWireObject } from '../protocol.ts';
import { resolveManagedToolsets } from './resolve-toolsets.ts';
import type { ManagedWebSettings } from './web-settings.ts';

const WEB_SEARCH_TOOL_TYPE = 'web_search_20250305';
const WEB_FETCH_TOOL_TYPE = 'web_fetch_20250910';

const decodeToolArray = Schema.decodeUnknownSync(Schema.Array(ManagedWireObject));

type WebServerTool = Readonly<Record<string, unknown>>;

function domainFields(
  override: { readonly allowed_domains?: ReadonlyArray<string>; readonly blocked_domains?: ReadonlyArray<string> },
  settings: ManagedWebSettings,
): Readonly<Record<string, unknown>> {
  if (override.allowed_domains !== undefined) {
    return { allowed_domains: override.allowed_domains };
  }

  if (override.blocked_domains !== undefined) {
    return { blocked_domains: override.blocked_domains };
  }

  if (settings.allowedDomains !== undefined) {
    return { allowed_domains: settings.allowedDomains };
  }

  if (settings.blockedDomains !== undefined) {
    return { blocked_domains: settings.blockedDomains };
  }

  return {};
}

/** Projects enabled `web_search` and `web_fetch` toolset entries into Anthropic Messages server tool declarations. */
export function resolveManagedWebServerTools(
  toolsJson: string,
  settings: ManagedWebSettings,
): ReadonlyArray<WebServerTool> {
  if (!settings.isEnabled) {
    return [];
  }

  const parsed: unknown = JSON.parse(toolsJson);
  const declarations = resolveManagedToolsets(decodeToolArray(parsed), settings);
  const builtin = declarations.find((entry) => entry.type === 'agent_toolset_20260401');

  if (builtin === undefined) {
    return [];
  }

  const tools: Array<WebServerTool> = [];
  const search = builtin.configs.find((entry) => entry.name === 'web_search');
  const isSearchEnabled = search?.enabled ?? false;

  if (isSearchEnabled && search !== undefined) {
    const declaration: Record<string, unknown> = {
      type: WEB_SEARCH_TOOL_TYPE,
      name: 'web_search',
      ...domainFields(search, settings),
    };

    if (search.user_location !== undefined) {
      declaration['user_location'] = search.user_location;
    }

    tools.push(declaration);
  }

  const fetchTool = builtin.configs.find((entry) => entry.name === 'web_fetch');
  const isFetchEnabled = fetchTool?.enabled ?? false;

  if (isFetchEnabled && fetchTool !== undefined) {
    const declaration: Record<string, unknown> = {
      type: WEB_FETCH_TOOL_TYPE,
      name: 'web_fetch',
      ...domainFields(fetchTool, settings),
    };

    const maxTokens = fetchTool.max_content_tokens ?? settings.maxContentTokens;

    if (maxTokens !== undefined) {
      declaration['max_content_tokens'] = maxTokens;
    }

    tools.push(declaration);
  }

  return tools;
}
