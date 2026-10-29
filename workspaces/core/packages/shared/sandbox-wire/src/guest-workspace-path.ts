import type { RecordId } from '@mechane/records';
import { Option } from 'effect';
import { GuestSegment, WorkspaceStep } from './constants.ts';

type GuestWorkspacePathInput = {
  readonly machineId: RecordId;
  readonly generation: string;
  readonly step: WorkspaceStep;
  /** Absent when the operation addresses the complete generation. */
  readonly part: Option.Option<number>;
};

/** Builds the generation route shared by the Worker and the portable guest. */
export function guestWorkspacePath({ machineId, generation, step, part }: GuestWorkspacePathInput): string {
  const machine = encodeURIComponent(machineId);
  const snapshot = encodeURIComponent(generation);

  const segments = ['', GuestSegment.Machines, machine, GuestSegment.Workspace, snapshot, step];

  if (step === WorkspaceStep.Part && Option.isSome(part)) {
    const index = part.value.toString();

    segments.push(index);
  }

  return segments.join('/');
}
