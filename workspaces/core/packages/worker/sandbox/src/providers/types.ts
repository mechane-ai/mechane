import type { Redacted } from 'effect';
import type { MachineIdInput } from '../types.ts';

/** The container and Durable Object lifecycle that own its inactivity policy. */
export type ContainerProviderInput = { readonly container: Container; readonly state: DurableObjectState };

/** The host launcher on this machine and the key it takes. */
export type HostProviderInput = { readonly launcherOrigin: URL; readonly launcherKey: Redacted.Redacted };

/** A machine's request to the host launcher, which starts the machine once and reports it after, or stops it. */
export type HostMachineInput = HostProviderInput & MachineIdInput;
