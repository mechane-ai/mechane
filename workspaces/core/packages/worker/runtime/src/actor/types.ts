import type { Conversation, Harness } from '@earendil-works/pi-durable';
import type { ControlStore } from '@mechane/control-store';
import type { RuntimeConfiguration } from '../config.ts';
import type { ActorNamespace, MechScope } from './client.ts';

export type RuntimeBindings = Readonly<Record<string, unknown>> & { readonly MECHS: ActorNamespace };

export type ActorAccess = {
  readonly harness: Harness;
  readonly conversation: Conversation;
  readonly scope: MechScope;
  readonly configuration: RuntimeConfiguration;
  readonly withControl: <T>(operation: (store: ControlStore) => Promise<T>) => Promise<T>;
  readonly arm: () => Promise<void>;
  readonly isDefinitionReady: () => boolean;
};
