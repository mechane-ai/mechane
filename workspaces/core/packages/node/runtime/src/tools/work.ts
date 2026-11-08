import { executionId } from '../execution-id.ts';
import { withRuntimeStore } from '../store/runtime-store.ts';
import type { RuntimeToolContext, ToolInvocation } from './types.ts';

type UpdateWorkInput = ToolInvocation & {
  readonly id?: string | undefined;
  readonly title: string;
  readonly state: 'open' | 'resolved' | 'abandoned';
  readonly note: string | null;
};

export async function listWork(input: RuntimeToolContext) {
  'use step';

  return await withRuntimeStore((store) => store.listWorkItems(input));
}

export async function updateWork(input: UpdateWorkInput) {
  'use step';

  const id = input.id ?? (await executionId(input));

  return await withRuntimeStore((store) => store.upsertWorkItem({ ...input, id }));
}

updateWork.maxRetries = 0;
