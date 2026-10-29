import { SandboxReport } from '@mechane/protocol';
import { DroneId } from '@mechane/records';
import { Schema } from 'effect';

/** The mech authorizes ownership before reaching a sandbox object. */
export const SandboxAnswer = Schema.TaggedUnion({
  Found: { report: SandboxReport },
  MechMissing: {},
  DroneMissing: { droneId: DroneId },
  Busy: {},
});

export type SandboxAnswer = typeof SandboxAnswer.Type;
