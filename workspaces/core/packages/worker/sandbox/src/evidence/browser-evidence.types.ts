import type { MachineId } from '@mechane/records';
import type { BrowserArtifactPartRequest, SandboxBrowserArtifactAnswer } from '@mechane/sandbox-wire';

type ReadCaptureInput = { readonly machineId: MachineId; readonly request: BrowserArtifactPartRequest };

/** Reads an immutable capture from its original guest without allocating a replacement machine. */
export type ReadCapture = ({ machineId, request }: ReadCaptureInput) => Promise<SandboxBrowserArtifactAnswer>;
