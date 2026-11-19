import { defineDoc } from '@earendil-works/pi-durable';
import { Record, Schema } from 'effect';
import { createHash } from 'node:crypto';

const ACTOR_STATE_VERSION = 1;
const CHECKPOINT_DELTA_COUNT = 100;
const STRING_CHUNK_UNITS = 32_768;
const SINGLE_UTF16_UNIT_MAX = 0xff_ff;

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

function* quoted(value: string) {
  if (value.length <= STRING_CHUNK_UNITS) {
    yield JSON.stringify(value);

    return;
  }

  yield '"';
  let start = 0;

  while (start < value.length) {
    let end = Math.min(value.length, start + STRING_CHUNK_UNITS);
    const last = value.codePointAt(end - 1) ?? 0;

    if (end < value.length && last > SINGLE_UTF16_UNIT_MAX) {
      end -= 1;
    }

    yield JSON.stringify(value.slice(start, end)).slice(1, -1);
    start = end;
  }

  yield '"';
}

// The same canonical fragments feed persisted identity hashes and equality comparisons.
function* canonicalParts(value: unknown): Generator<string> {
  if (typeof value === 'string') {
    yield* quoted(value);

    return;
  }

  if (Array.isArray(value)) {
    yield '[';

    for (let index = 0; index < value.length; index += 1) {
      if (index > 0) {
        yield ',';
      }

      if (index in value) {
        yield* canonicalParts(value[index]);
      }
    }

    yield ']';

    return;
  }

  if (value !== null && typeof value === 'object') {
    yield '{';
    let separator = '';

    for (const [key, entry] of Record.toEntries(value).toSorted(([left], [right]) => {
      if (left < right) {
        return -1;
      }

      if (left > right) {
        return 1;
      }

      return 0;
    })) {
      yield separator;

      yield* quoted(key);

      yield ':';

      yield* canonicalParts(entry);

      separator = ',';
    }

    yield '}';

    return;
  }

  yield JSON.stringify([value]).slice(1, -1);
}

export function stableJson(value: unknown): string {
  return Array.from(canonicalParts(value)).join('');
}

export async function fingerprint(value: unknown): Promise<string> {
  const hash = createHash('sha256');

  for (const fragment of canonicalParts(value)) {
    hash.update(fragment);
  }

  return hash.digest('hex');
}
