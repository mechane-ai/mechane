import type { RecordId, SourceId } from '@mechane/records';
import type { SourceStep } from './source.constants.ts';

type GuestSourcePathInput = {
  readonly machineId: RecordId;
  readonly sourceId: SourceId;
  readonly generation: SourceId;
  readonly step: SourceStep;
};

/** Both machine and checkout generation bind guest requests to the active fence. */
export function guestSourcePath({ machineId, sourceId, generation, step }: GuestSourcePathInput): string {
  return `/machines/${encodeURIComponent(machineId)}/source/${encodeURIComponent(sourceId)}/${encodeURIComponent(generation)}/${step}`;
}
