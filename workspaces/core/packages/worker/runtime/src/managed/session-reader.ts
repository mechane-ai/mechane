import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { createSession } from '@earendil-works/pi-durable';
import type { Storage } from '@earendil-works/pi-durable';
import type { WithControl } from '../actor/types.ts';
import { createManagedSessionView } from './session-view.ts';
import { managedUsageProjector } from './usage-projection.ts';

type ReaderOptions = { readonly storage: Storage; readonly workspaceId: string; readonly withControl: WithControl };

export function openManagedSessionReader({ storage, workspaceId, withControl }: ReaderOptions) {
  const session = createSession(storage);
  const owner = { harness: session, workspaceId, withControl };
  const flushUsage = managedUsageProjector(owner);
  const view = createManagedSessionView({ ...owner, flushUsage });

  async function close() {
    await session.close(BACKGROUND_CONTEXT);
  }

  return {
    harness: session,
    read: view.read,
    thread: view.thread,
    threads: view.threads,
    events: view.events,
    tail: view.tail,
    changes: view.changes,
    close,
  };
}

export type ManagedSessionReader = Omit<ReturnType<typeof openManagedSessionReader>, 'close'>;
