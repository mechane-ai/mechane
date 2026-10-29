import { Finding, Watch } from '@mechane/protocol';
import { Schema } from 'effect';

/** The saved watch or the durable refusal to change it. */
export const WatchAnswer = Schema.TaggedUnion({
  Saved: { watch: Watch },
  MechMissing: {},
  WatchMissing: {},
  LimitReached: {},
});

export type WatchAnswer = typeof WatchAnswer.Type;

/** The saved schedules or a missing-mech decision. */
export const WatchesAnswer = Schema.TaggedUnion({ Listed: { watches: Schema.Array(Watch) }, MechMissing: {} });

export type WatchesAnswer = typeof WatchesAnswer.Type;

/** The current findings or a missing mech or watch decision. */
export const FindingsAnswer = Schema.TaggedUnion({
  Listed: { findings: Schema.Array(Finding) },
  MechMissing: {},
  WatchMissing: {},
});

export type FindingsAnswer = typeof FindingsAnswer.Type;
