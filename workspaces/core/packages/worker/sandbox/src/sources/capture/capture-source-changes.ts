import type { RecordId } from '@mechane/records';
import { SourceCapture, SourceGuestAnswer, SourceStep } from '@mechane/sandbox-wire';
import { Option, Schema } from 'effect';
import type { MachineProvider } from '../../types.ts';
import { callSourceGuest } from '../guest/call-source-guest.ts';

type CaptureSourceChangesInput = {
  readonly capture: SourceCapture;
  readonly machineId: RecordId;
  readonly provider: MachineProvider;
};

/** The guest holds command execution while reading the patch and must release it before capture succeeds. */
export async function captureSourceChanges({
  capture,
  machineId,
  provider,
}: CaptureSourceChangesInput): Promise<SourceGuestAnswer> {
  const connected = await provider.connect({ machineId });

  if (Option.isNone(connected)) {
    return SourceGuestAnswer.cases.Pending.make({});
  }

  const guest = connected.value;
  const empty = Option.none<string>();
  const connection = { guest, machineId, sourceId: capture.sourceId, generation: capture.sourceId };
  const prepared = await callSourceGuest({ ...connection, step: SourceStep.PrepareCapture, body: empty });

  if (!SourceGuestAnswer.guards.Ready(prepared)) {
    return prepared;
  }

  const schema = Schema.fromJsonString(SourceCapture);
  const encoded = Schema.encodeSync(schema)(capture);
  const body = Option.some(encoded);
  const answer = await callSourceGuest({ ...connection, step: SourceStep.Changes, body });
  const released = await callSourceGuest({ ...connection, step: SourceStep.Release, body: empty });

  if (!SourceGuestAnswer.guards.Ready(released)) {
    return SourceGuestAnswer.cases.Failed.make({ reason: 'source capture did not release its guest fence' });
  }

  return answer;
}
