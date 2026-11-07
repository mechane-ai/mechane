import { tool } from 'ai';
import type { ToolSet } from 'ai';
import { z } from 'zod';
import { executeBash, observeBash } from './bash.ts';
import { createBrowserTools } from './browser/browser-tools.ts';
import { BASH_DEFAULT_TIMEOUT_MS, BASH_MAX_TIMEOUT_MS, MEMORY_MAX_TEXT_LENGTH } from './constants.ts';
import { discoverMcpTools, mcpTools } from './mcp.ts';
import { deleteMemory, readMemory, writeMemory } from './memory.ts';
import { processTools } from './processes/process-tools.ts';
import { readToolResult } from './tool-result.ts';
import type { RuntimeToolContext } from './types.ts';
import { waitForWork } from './wait.ts';
import { listWork, updateWork } from './work.ts';

type PreparedTools = { readonly tools: ToolSet; readonly notices: ReadonlyArray<string> };

const MEMORY_PATH_MAX_LENGTH = 256;
const WORK_TITLE_MAX_LENGTH = 240;
const WAIT_MAX_SECONDS = 86_400;
const WAIT_REASON_MAX_CHARACTERS = 500;
const MemoryPath = z.string().min(1).max(MEMORY_PATH_MAX_LENGTH);

export async function prepareRuntimeTools(context: RuntimeToolContext): Promise<PreparedTools> {
  const discovered = await discoverMcpTools(context);
  const native = createRuntimeTools(context);
  const remote = mcpTools(context, discovered.tools);

  return { tools: { ...native, ...remote }, notices: discovered.notices };
}

function createRuntimeTools(context: RuntimeToolContext): ToolSet {
  return {
    ...createBrowserTools(context),
    ...processTools(context),
    read_tool_result: tool({
      description:
        'Read a bounded chunk of a saved shell or MCP result without repeating the operation. Offsets count string characters and the result supplies the next offset.',
      inputSchema: z.object({ executionId: z.uuid(), offsetCharacters: z.number().int().nonnegative().default(0) }),
      execute: (input) => readToolResult({ ...context, ...input }),
    }),
    wait: tool({
      description:
        'Wait durably before checking CI, a deployment, or other external work. This releases compute while preserving the task and original reply destination. Waiting does not prove the external work succeeded.',
      inputSchema: z.object({
        seconds: z.number().positive().max(WAIT_MAX_SECONDS),
        reason: z.string().min(1).max(WAIT_REASON_MAX_CHARACTERS),
      }),
      execute: (input, options) => waitForWork({ ...context, ...input, toolCallId: options.toolCallId }),
    }),
    bash: tool({
      description:
        'Run a shell command in the mech’s persistent developer environment. Current owner-granted GitHub and Nexus CLI credentials are available there. A result marked uncertain may already have caused external effects; inspect those effects before repeating it.',
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
    memory_read: tool({
      description:
        'Read one durable memory document, or list all memory documents when path is omitted. Use its version when changing it.',
      inputSchema: z.object({ path: MemoryPath.optional() }),
      execute: (input) => readMemory({ ...context, ...input }),
    }),
    memory_write: tool({
      description:
        'Save durable knowledge for this mech. Supply the version you read, or null to create a new document. Do not save credentials.',
      inputSchema: z.object({
        path: MemoryPath,
        text: z.string().max(MEMORY_MAX_TEXT_LENGTH),
        expectedVersion: z.number().int().positive().nullable(),
      }),
      execute: (input) => writeMemory({ ...context, ...input }),
    }),
    memory_delete: tool({
      description: 'Delete a durable memory document only if its version is unchanged.',
      inputSchema: z.object({ path: MemoryPath, expectedVersion: z.number().int().positive() }),
      execute: (input) => deleteMemory({ ...context, ...input }),
    }),
    work_list: tool({
      description: 'Read the mech’s tracked work and outcomes.',
      inputSchema: z.object({}),
      execute: () => listWork(context),
    }),
    work_update: tool({
      description:
        'Create or update a tracked work item. Omitting id creates a stable item for this call. Record verified outcomes in note.',
      inputSchema: z.object({
        id: z.uuid().optional(),
        title: z.string().min(1).max(WORK_TITLE_MAX_LENGTH),
        state: z.enum(['open', 'resolved', 'abandoned']),
        note: z.string().max(MEMORY_MAX_TEXT_LENGTH).nullable(),
      }),
      execute: (input, options) => updateWork({ ...context, ...input, toolCallId: options.toolCallId }),
    }),
  };
}
