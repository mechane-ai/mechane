import type { Redacted } from 'effect';
import type { MachineIdInput } from '../../types.ts';

/** An authenticated request to a named process on a validated guest origin. */
export type RemoteProcessInput = MachineIdInput & { readonly apiKey: Redacted.Redacted; readonly origin: URL };
