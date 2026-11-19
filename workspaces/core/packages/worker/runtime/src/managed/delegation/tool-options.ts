import type { Harness } from '@earendil-works/pi-durable';
import type { ExclusiveEffect } from '../execution-gate.ts';
import type { ManagedAgentScope } from '../protocol.ts';

export type CoordinatorToolOptions = {
  readonly identity: ExclusiveEffect;
  readonly scope: ManagedAgentScope;
  readonly sessionId: string;
  readonly roster: string;
  readonly harness: () => Harness;
  readonly wake: () => void;
};
