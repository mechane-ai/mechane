import type { MachineIdInput } from '../../types.ts';

type ProcessUrlInput = MachineIdInput & { readonly origin: URL };

/** Addresses the guest process by the machine identity whose execution receipts it holds. */
export function processUrl({ origin, machineId }: ProcessUrlInput): URL {
  const path = processPath({ machineId });

  return new URL(path, origin);
}

function processPath({ machineId }: MachineIdInput): string {
  const encoded = encodeURIComponent(machineId);

  return `/api/v1/processes/${encoded}`;
}
