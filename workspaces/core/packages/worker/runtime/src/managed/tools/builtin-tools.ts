import workerInputs from './worker-inputs.generated.json' with { type: 'json' };

export const WORKER_TOOLS = ['bash', 'edit', 'glob', 'grep', 'read', 'write'] as const;
type WorkerTool = (typeof WORKER_TOOLS)[number];
type Builtin = WorkerTool | 'web_fetch' | 'web_search';

const builtins: ReadonlyArray<Builtin> = [...WORKER_TOOLS, 'web_fetch', 'web_search'];

export function builtinName(value: unknown): Builtin {
  const name = builtins.find((tool) => tool === value);

  if (name === undefined) {
    throw new Error('Unknown agent tool name');
  }

  return name;
}

export function workerInput(name: WorkerTool): (typeof workerInputs)[WorkerTool] {
  return workerInputs[name];
}
