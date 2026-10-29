import type { RecordId } from '@mechane/records';
import type { SandboxStore, SourceFence } from '@mechane/sandbox-store';
import { SourceClone, SourceFencePhase, SourceGuestAnswer, SourceStep } from '@mechane/sandbox-wire';
import type { SourceFenceReport } from '@mechane/sandbox-wire';
import { Option, Schema } from 'effect';
import type { GuestConnection } from '../../types.ts';
import { callSourceGuest } from '../guest/call-source-guest.ts';
import { sourceReport } from '../source-report.ts';

type ExposeSourceInput = {
  readonly store: SandboxStore;
  readonly fence: SourceFence;
  readonly clone: SourceClone;
  readonly machineId: RecordId;
  readonly guest: GuestConnection;
};

/** Records exact credential expiry before delivery, so a lost guest response cannot release its authority early. */
export async function exposeSource({
  store,
  fence,
  clone,
  guest,
  machineId,
}: ExposeSourceInput): Promise<SourceFenceReport> {
  const exposed = { ...fence, phase: SourceFencePhase.Exposed, expiresAt: Option.some(clone.expiresAt) };

  store.saveSourceFence({ fence: exposed });

  const schema = Schema.fromJsonString(SourceClone);
  const encoded = Schema.encodeSync(schema)(clone);
  const body = Option.some(encoded);
  const result = await callSourceGuest({ ...clone, guest, machineId, step: SourceStep.Clone, body });
  const isCloned = SourceGuestAnswer.guards.Ready(result);
  let reason = Option.none<string>();

  if (!isCloned) {
    reason = Option.some('source clone did not complete');
  }

  const completed = { ...exposed, isCloned, reason };

  store.saveSourceFence({ fence: completed });

  return sourceReport({ fence: completed });
}
