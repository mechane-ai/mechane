import type { NativeToolName } from '@mechane/protocol';
import { tool } from 'ai';
import type { ToolSet } from 'ai';
import { Record } from 'effect';
import { z } from 'zod';
import { executeBash, observeBash } from './bash.ts';
import { createBrowserTools } from './browser/browser-tools.ts';
import { consoleMessageTool } from './console-message.ts';
import { BASH_DEFAULT_TIMEOUT_MS, BASH_MAX_TIMEOUT_MS } from './constants.ts';
import { exportEvidenceTool } from './export-evidence.ts';
import type { McpDefinition } from './mcp-definitions.ts';
import { discoverMcpTools, mcpTools } from './mcp.ts';
import { permitsNativeTool } from './native-tools.ts';
import { processTools } from './processes/process-tools.ts';
import { readToolResult } from './tool-result.ts';
import type { RuntimeToolContext } from './types.ts';

type PreparedTools = {
  readonly tools: ToolSet;
  readonly notices: ReadonlyArray<string>;
  readonly mcpDefinitions: ReadonlyArray<McpDefinition>;
  readonly isComplete: boolean;
};

type NativeToolsInput = { readonly nativeTools?: ReadonlyArray<NativeToolName> | null | undefined };
type PrepareRuntimeToolsInput = RuntimeToolContext & NativeToolsInput & { readonly shouldDiscoverMcp?: boolean };

type RuntimeToolsInput = RuntimeToolContext &
  NativeToolsInput & { readonly mcpDefinitions: ReadonlyArray<McpDefinition> };

export async function prepareRuntimeTools({
  shouldDiscoverMcp = true,
  ...context
}: PrepareRuntimeToolsInput): Promise<PreparedTools> {
  let discovered: Awaited<ReturnType<typeof discoverMcpTools>> = { tools: [], notices: [], isComplete: true };

  if (shouldDiscoverMcp) {
    discovered = await discoverMcpTools(context);
  }

  return {
    tools: runtimeTools({ ...context, mcpDefinitions: discovered.tools }),
    notices: discovered.notices,
    mcpDefinitions: discovered.tools,
    isComplete: discovered.isComplete,
  };
}

export function runtimeTools({ mcpDefinitions, nativeTools, ...context }: RuntimeToolsInput): ToolSet {
  const native = Record.filter(createRuntimeTools(context), (_tool, name) => permitsNativeTool({ name, nativeTools }));
  const remote = mcpTools(context, mcpDefinitions);

  return { ...native, ...remote };
}

function createRuntimeTools(context: RuntimeToolContext): ToolSet {
  return {
    ...createBrowserTools(context),
    ...processTools(context),
    console_message: consoleMessageTool(context),
    export_evidence: exportEvidenceTool(context),
    read_tool_result: tool({
      description:
        'Read a bounded chunk of a saved shell or MCP result without repeating the operation. Offsets count string characters and the result supplies the next offset.',
      inputSchema: z.object({ executionId: z.uuid(), offsetCharacters: z.number().int().nonnegative().default(0) }),
      execute: (input) => readToolResult({ ...context, ...input }),
    }),
    bash: tool({
      description:
        'Run a shell command in the mech’s persistent environment with its installed CLIs and granted credentials. Keep notes and files in the home directory. Completed confirms the durable command outcome; home files save separately in background checkpoints. A result marked uncertain may already have caused external effects; inspect those effects before repeating it.',
      inputSchema: z.object({
        command: z.string().min(1),
        timeoutMs: z.number().int().positive().max(BASH_MAX_TIMEOUT_MS).default(BASH_DEFAULT_TIMEOUT_MS),
      }),
      execute: (input, options) => executeBash({ ...context, ...input, toolCallId: options.toolCallId }),
    }),
    bash_status: tool({
      description: 'Observe an existing execution without running the command again.',
      inputSchema: z.object({ executionId: z.uuid() }),
      execute: (input) => observeBash({ ...context, ...input }),
    }),
  };
}
