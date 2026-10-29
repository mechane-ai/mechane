import { Option } from 'effect';
import type { MachineProvider } from '../types.ts';
import { connectSandbox } from './connect-sandbox.ts';
import { startSandbox } from './machines/start-sandbox.ts';
import { suspendSandbox } from './machines/suspend-sandbox.ts';
import { manageRemote } from './maintenance/manage-remote.ts';
import { stopGuest } from './stop-guest.ts';
import type { TensorlakeSettings } from './types.ts';

/** Hosts one persistent private VM per Durable Object while Cloudflare owns execution identities and receipts. */
export function tensorlakeProvider({ ...settings }: TensorlakeSettings): MachineProvider {
  const suspend: (input: Parameters<MachineProvider['stop']>[0]) => Promise<void> = () => suspendSandbox(settings);

  return {
    manage: Option.some((request) => manageRemote({ ...settings, request })),
    start: () => startSandbox(settings),
    connect: ({ machineId }) => connectSandbox({ ...settings, machineId }),
    stop: ({ machineId }) => stopGuest({ ...settings, machineId }),
    suspend: Option.some(suspend),
  };
}
