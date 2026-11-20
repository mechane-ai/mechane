import type { SlotNamespace } from '@mechane/agent-slot';
import type { ControlStore, InstalledSession } from '@mechane/control-store';
import type { RuntimeConfiguration } from '../config.ts';

export type RuntimeBindings = Readonly<Record<string, unknown>> & {
  readonly SESSIONS: SlotNamespace;
  readonly AGENT_SLOTS: SlotNamespace;
  readonly HYPERDRIVE?: Hyperdrive;
};

export type WithControl = <T>(operation: (store: ControlStore) => Promise<T>) => Promise<T>;

export type InstalledWorkerWake = (session: InstalledSession) => void;

export type InstalledWorkerScheduler = (input: {
  readonly configuration: RuntimeConfiguration;
  readonly sessions: Pick<SlotNamespace, 'getByName'>;
  readonly execution: Pick<ExecutionContext, 'waitUntil'>;
}) => InstalledWorkerWake;
