import { tool } from 'ai';
import type { ToolSet } from 'ai';
import { z } from 'zod';
import { executeBash, observeBash } from './bash.ts';
import { createBrowserTools } from './browser/browser-tools.ts';
import { consoleMessageTool } from './console-message.ts';
import { BASH_DEFAULT_TIMEOUT_MS, BASH_MAX_TIMEOUT_MS } from './constants.ts';
import { guardToolDispatch } from './dispatch.ts';
import { discoverMcpTools, mcpTools } from './mcp.ts';
import { processTools } from './processes/process-tools.ts';
import { readToolResult } from './tool-result.ts';
import type { RuntimeToolContext } from './types.ts';

type PreparedTools = { readonly tools: ToolSet; readonly notices: ReadonlyArray<string> };

export async function prepareRuntimeTools(context: RuntimeToolContext): Promise<PreparedTools> {
  const discovered = await discoverMcpTools(context);
  const native = createRuntimeTools(context);
  const remote = mcpTools(context, discovered.tools);

  return { tools: guardToolDispatch({ context, tools: { ...native, ...remote } }), notices: discovered.notices };
}

function createRuntimeTools(context: RuntimeToolContext): ToolSet {
  return {
    ...createBrowserTools(context),
    ...processTools(context),
    console_message: consoleMessageTool(context),
    read_tool_result: tool({
      description:
        'Read a bounded chunk of a saved shell or MCP result without repeating the operation. Offsets count string characters and the result supplies the next offset.',
      inputSchema: z.object({ executionId: z.uuid(), offsetCharacters: z.number().int().nonnegative().default(0) }),
      execute: (input) => readToolResult({ ...context, ...input }),
    }),
    bash: tool({
      description:
        'Run a shell command in the mech’s persistent environment with its installed CLIs and granted credentials. Keep durable notes and files in the home directory. A result marked uncertain may already have caused external effects; inspect those effects before repeating it.',
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
