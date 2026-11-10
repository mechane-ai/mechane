import { defineDoc } from '@earendil-works/pi-durable';
import { Record, Schema } from 'effect';

const ACTOR_STATE_VERSION = 1;
const CHECKPOINT_DELTA_COUNT = 100;
const HEXADECIMAL_RADIX = 16;
const HEXADECIMAL_BYTE_DIGITS = 2;

const NullableText = Schema.NullOr(Schema.String);

// Lifetime records use separate documents so control state does not grow with a mech's history.
const ControlState = Schema.Struct({
  scope: Schema.NullOr(Schema.Struct({ workspaceId: Schema.String, mechId: Schema.String })),
  controlSequence: Schema.Number,
  activeRevision: Schema.Number,
  isQuiesced: Schema.Boolean,
  exportHold: Schema.NullOr(Schema.Struct({ id: Schema.String, shouldRelease: Schema.Boolean })),
  isPolicyPaused: Schema.Boolean,
  isEnvironmentCheckpointRequired: Schema.Boolean,
  checkpointBarrier: NullableText,
  isResumePending: Schema.Boolean,
  isImportComplete: Schema.Boolean,
  importSequence: Schema.Number,
  importDigest: NullableText,
  notificationBaseSequence: Schema.Number,
  observedSequence: Schema.Number,
  eventBaseSequence: Schema.Number,
  messageBaseSequence: Schema.Number,
});

export type ActorState = typeof ControlState.Type;

export const State = defineDoc<ActorState>({
  kind: 'mechane.actor',
  version: ACTOR_STATE_VERSION,
  scope: 'session',
  initial: () => ({
    scope: null,
    controlSequence: 0,
    activeRevision: 0,
    isQuiesced: false,
    exportHold: null,
    isPolicyPaused: false,
    isEnvironmentCheckpointRequired: false,
    checkpointBarrier: null,
    isResumePending: false,
    isImportComplete: true,
    importSequence: 0,
    importDigest: null,
    notificationBaseSequence: 0,
    observedSequence: 0,
    eventBaseSequence: 0,
    messageBaseSequence: 0,
  }),
  checkpointWhen: (_value, _operations, checkpoint) => checkpoint.deltasSinceBase >= CHECKPOINT_DELTA_COUNT,
});

// Canonical fingerprints walk the recursive JSON tree while sorting each object's own keys.
// ast-grep-ignore: loop-recursion
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }

  if (value !== null && typeof value === 'object') {
    return `{${Record.toEntries(value)
      .toSorted(([left], [right]) => {
        if (left < right) {
          return -1;
        }

        if (left > right) {
          return 1;
        }

        return 0;
      })
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(',')}}`;
  }

  return JSON.stringify([value]).slice(1, -1);
}

export async function fingerprint(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stableJson(value)));

  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(HEXADECIMAL_RADIX).padStart(HEXADECIMAL_BYTE_DIGITS, '0'),
  ).join('');
}
