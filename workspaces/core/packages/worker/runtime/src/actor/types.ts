import type { ControlStore, InstalledSession } from '@mechane/control-store';
import type { RuntimeConfiguration } from '../config.ts';
import type { ActorNamespace } from './client.ts';

export type RuntimeBindings = Readonly<Record<string, unknown>> & {
  readonly MECHS: ActorNamespace & Pick<DurableObjectNamespace, 'idFromName'>;
};

export type WithControl = <T>(operation: (store: ControlStore) => Promise<T>) => Promise<T>;

export type InstalledWorkerWake = (session: InstalledSession) => void;

export type InstalledWorkerScheduler = (input: {
  readonly configuration: RuntimeConfiguration;
  readonly actors: ActorNamespace;
  readonly execution: Pick<ExecutionContext, 'waitUntil'>;
}) => InstalledWorkerWake;
