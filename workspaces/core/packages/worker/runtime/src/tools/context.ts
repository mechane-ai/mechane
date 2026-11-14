import type { Tx } from '@earendil-works/pi-durable';
import type { ControlStore } from '@mechane/control-store';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { RuntimeConfiguration } from '../config.ts';
import type { ActivityEvent, ConsoleMessage, ExecutionReceipt, Run } from '../domain.ts';
import { ToolNotStartedError } from './errors.ts';
import { isNativeToolCurrent } from './native-tools.ts';
import type { RuntimeToolContext } from './types.ts';

export type RuntimeToolStore = ControlStore & {
  readonly canDispatchExecution: (transaction?: Tx) => Promise<boolean>;
  readonly getRun: (input: { readonly runId: string; readonly workspaceId?: string }) => Promise<Run | null>;
  readonly beginExecution: (input: {
    readonly id: string;
    readonly runId: string;
    readonly kind: ExecutionReceipt['kind'];
    readonly request?: Readonly<Record<string, unknown>>;
  }) => Promise<{ readonly receipt: ExecutionReceipt; readonly wasCreated: boolean }>;
  readonly finishExecution: (input: {
    readonly id: string;
    readonly status: ExecutionReceipt['status'];
    readonly providerId: string | null;
    readonly result: Readonly<Record<string, unknown>>;
  }) => Promise<ExecutionReceipt>;
  readonly getExecution: (input: {
    readonly id: string;
    readonly workspaceId: string;
    readonly mechId: string;
  }) => Promise<ExecutionReceipt | null>;
  readonly listRunExecutions: (input: {
    readonly runId: string;
    readonly workspaceId: string;
  }) => Promise<ReadonlyArray<ExecutionReceipt & { readonly mechId: string }>>;
  readonly appendActivity: (input: Omit<ActivityEvent, 'sequence' | 'createdAt'>) => Promise<void>;
  readonly publishConsoleMessage: (input: {
    readonly runId: string;
    readonly toolCallId: string;
    readonly text: string;
    readonly presentation?: Readonly<Record<string, unknown>>;
  }) => Promise<ConsoleMessage>;
};

type ToolOwner = {
  readonly configuration: RuntimeConfiguration;
  readonly withStore: <T>(operation: (store: RuntimeToolStore) => Promise<T>) => Promise<T>;
};

const owners: Readonly<AsyncLocalStorage<ToolOwner>> = new AsyncLocalStorage<ToolOwner>();

export async function withToolOwner<T>(owner: ToolOwner, operation: () => Promise<T>): Promise<T> {
  return await owners.run(owner, operation);
}

export async function withToolStore<T>(operation: (store: RuntimeToolStore) => Promise<T>): Promise<T> {
  const owner = owners.getStore();

  if (owner === undefined) {
    throw new Error('The tool invocation has no actor owner');
  }

  return await owner.withStore(operation);
}

export async function requireNativeTool(input: RuntimeToolContext & { readonly name: string }): Promise<void> {
  await withToolStore(async (store) => {
    if (!(await isNativeToolCurrent({ store, ...input }))) {
      throw new ToolNotStartedError('The current definition does not permit this native tool');
    }
  });
}

export function toolConfiguration(): RuntimeConfiguration {
  const owner = owners.getStore();

  if (owner === undefined) {
    throw new Error('The tool invocation has no actor configuration');
  }

  return owner.configuration;
}
