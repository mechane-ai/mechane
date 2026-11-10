import { tool } from 'ai';
import type { ToolSet } from 'ai';
import { z } from 'zod';
import { toolConfiguration, withToolStore } from '../context.ts';
import type { RuntimeToolContext } from '../types.ts';
import { listSandboxProcesses, readSandboxProcess, stopSandboxProcess } from './client.ts';
import { processObservation } from './results.ts';
import type { ProcessToolResult } from './results.ts';
import { startProcess } from './start.ts';

const ProcessSelection = z.strictObject({ processId: z.uuid(), machineId: z.uuid() });
type ProcessSelection = RuntimeToolContext & z.infer<typeof ProcessSelection>;

/** Generic process tools leave shell commands to the agent while keeping handles durable and machine-bound. */
export function processTools(context: RuntimeToolContext): ToolSet {
  return {
    start_process: tool({
      description:
        'Start a long-lived shell process, such as a build or local development server. It survives later activations and ordinary file checkpoints. Its completion arrives as a notification. A running result is not proof of application readiness. Use the returned process and machine IDs for reads and stops.',
      inputSchema: z.strictObject({ command: z.string().min(1) }),
      execute: (input, options) => startProcess({ ...context, ...input, toolCallId: options.toolCallId }),
    }),
    read_process: tool({
      description: 'Read the state and bounded redacted logs of one exact process handle without restarting it.',
      inputSchema: ProcessSelection,
      execute: (input) => readProcess({ ...context, ...input }),
    }),
    list_processes: tool({
      description: 'List live managed processes and bounded recent terminal history without allocating compute.',
      inputSchema: z.strictObject({}),
      execute: () => listProcesses(context),
    }),
    stop_process: tool({
      description: 'Stop one managed process group using its original machine and process IDs.',
      inputSchema: ProcessSelection,
      execute: (input) => stopProcess({ ...context, ...input }),
    }),
  };
}

async function readProcess(input: ProcessSelection): Promise<ProcessToolResult> {
  const configuration = toolConfiguration();
  const observation = await readSandboxProcess({ ...input, configuration, shouldTouch: true });

  return processObservation(observation);
}

async function stopProcess(input: ProcessSelection): Promise<ProcessToolResult> {
  const configuration = toolConfiguration();
  const observation = await stopSandboxProcess({ ...input, configuration });

  return processObservation(observation);
}

async function listProcesses(input: RuntimeToolContext) {
  const configuration = toolConfiguration();

  await withToolStore(async (store) => await store.getMech(input));

  const processes = await listSandboxProcesses({ ...input, configuration, shouldTouch: true });

  return processes.map(({ handle, state }) => ({ ...handle, state: state._tag }));
}
