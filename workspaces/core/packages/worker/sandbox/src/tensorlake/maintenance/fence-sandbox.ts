import type { SandboxStore } from '@mechane/sandbox-store';
import { DateTime, Option } from 'effect';

type FenceSandboxInput = { readonly store: SandboxStore };

/** A replacement guest cannot claim that the retired process still holds its receipt ledger. */
export function fenceSandbox({ store }: FenceSandboxInput): void {
  const live = store.liveMachine();

  if (Option.isSome(live)) {
    const now = DateTime.nowUnsafe();

    store.loseMachine({ machineId: live.value.id, now });
  }
}
