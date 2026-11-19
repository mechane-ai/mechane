import type { Context } from '@earendil-works/chord/context';
import { defineExtension, defineTool } from '@earendil-works/pi-durable';
import type { Extension, ToolExecutionResult, ToolRegistration } from '@earendil-works/pi-durable';
import { Schema } from 'effect';
import type { ManagedMcpTool } from './mcp/types.ts';
import { ManagedWireObject } from './protocol.ts';
import { WORKER_TOOLS, workerInput } from './tools/builtin-tools.ts';
import { checkManagedToolNames, resolveManagedToolsets } from './tools/resolve-toolsets.ts';
import type { ManagedPermission } from './tools/tool-settings.ts';
import type { ManagedWebSettings } from './tools/web-settings.ts';

export type ManagedToolCall = {
  readonly sessionId: string;
  readonly nativeId: string;
  readonly name: string;
  readonly kind: 'worker' | 'mcp' | 'custom';
  readonly input: Readonly<Record<string, unknown>>;
  readonly policy: ManagedPermission | null;
  readonly mcpServerName?: string;
};

type Dispatch = (call: ManagedToolCall, context: Context) => Promise<ToolExecutionResult>;

type ToolDefinition = Pick<ManagedToolCall, 'name' | 'kind' | 'policy' | 'mcpServerName'> & {
  readonly modelName: string;
  readonly description: string;
  readonly parameters: Readonly<Record<string, unknown>>;
};

type Declaration = ReturnType<typeof resolveManagedToolsets>[number];

function toolSpecs(declaration: Declaration, discovered: ReadonlyArray<ManagedMcpTool>): ReadonlyArray<ToolDefinition> {
  switch (declaration.type) {
    case 'custom':
      return [
        {
          kind: 'custom',
          name: declaration.name,
          modelName: declaration.name,
          policy: null,
          description: declaration.description,
          parameters: declaration.input_schema,
        },
      ];
    case 'agent_toolset_20260401':
      return WORKER_TOOLS.flatMap((name) => {
        const setting =
          declaration.configs.find((configuration) => configuration.name === name) ?? declaration.default_config;

        if (!setting.enabled) {
          return [];
        }

        const schema = workerInput(name);

        return [
          {
            kind: 'worker',
            modelName: name,
            name,
            description: schema.description,
            parameters: schema,
            policy: setting.permission_policy.type,
          },
        ];
      });
    case 'mcp_toolset':
      return discovered
        .filter((tool) => tool.serverName === declaration.mcp_server_name)
        .flatMap((tool) => {
          const setting =
            declaration.configs.find((configuration) => configuration.name === tool.name) ?? declaration.default_config;

          if (!setting.enabled) {
            return [];
          }

          return [
            {
              kind: 'mcp',
              name: tool.name,
              modelName: tool.modelName,
              mcpServerName: tool.serverName,
              description: tool.description,
              parameters: tool.inputSchema,
              policy: setting.permission_policy.type,
            },
          ];
        });
  }
}

type ExtensionInput = {
  readonly sessionId: string;
  readonly tools: ReadonlyArray<ManagedWireObject>;
  readonly dispatch: Dispatch;
  readonly web?: ManagedWebSettings;
  readonly discovered?: ReadonlyArray<ManagedMcpTool>;
};

export function managedToolExtension({ sessionId, tools, dispatch, discovered = [], web }: ExtensionInput): Extension {
  const declarations = resolveManagedToolsets(tools, web);
  const specs = declarations.flatMap((declaration) => toolSpecs(declaration, discovered));

  checkManagedToolNames(specs.map((spec) => spec.modelName));

  const registrations: Array<ToolRegistration> = specs.map((spec) => {
    const { modelName, description, parameters, ...call } = spec;

    return defineTool({
      name: modelName,
      description,
      parameters,
      executionMode: 'sequential',
      replay: 'safe',
      execute: async (args, api, context) => {
        const input = Schema.decodeUnknownSync(ManagedWireObject)(args);

        return await dispatch({ ...call, sessionId, nativeId: String(api.taskId), input }, context);
      },
    });
  });

  return defineExtension({ name: sessionId, tools: registrations });
}
