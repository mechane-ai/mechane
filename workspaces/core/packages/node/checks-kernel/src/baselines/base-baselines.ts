import { Array, Effect, Schema } from 'effect';
import { BASELINE_FOLDER } from '../constants.ts';
import { InputUnreadable } from '../errors.ts';
import { folderPrefixPath } from '../folder-prefix-path.ts';
import { baselinePath } from '../ratchets/baseline-path.ts';
import { Baseline } from '../schemas.ts';
import type { Ratchet } from '../types.ts';
import { gitLines } from '../workspace/git-lines.ts';
import { baseBaselineName } from './base-baseline-name.ts';

/** The merge base `base`, the ratchets whose baselines it may hold, and the variables git inherits. */
type BaseBaselinesInput = {
  readonly base: string;
  readonly ratchets: ReadonlyArray<Ratchet>;
  readonly inherited: Readonly<Record<string, string>>;
};

type CommittedBaselineInput = {
  readonly base: string;
  readonly rule: string;
  readonly inherited: Readonly<Record<string, string>>;
};

/**
 * The baseline each ratchet held at the merge base `base`, by its rule, which caps every count the branch holds. A
 * ratchet with none there is new on the branch.
 */
export const baseBaselines = Effect.fn('baseBaselines')(function* ({
  base,
  ratchets,
  inherited,
}: BaseBaselinesInput): Effect.fn.Return<ReadonlyMap<string, Baseline>, InputUnreadable> {
  const folder = folderPrefixPath({ folder: BASELINE_FOLDER });
  const listed = new Set(yield* gitLines({ args: ['ls-tree', '-r', '--name-only', base, folder], inherited }));
  const isListed: (rule: string) => boolean = (rule) => listed.has(baselinePath({ rule }));
  const rules = ratchets.map(({ rule }) => rule).filter(isListed);

  const baselines = yield* Effect.forEach(rules, (rule) => committedBaseline({ base, rule, inherited }), {
    concurrency: 1,
  });

  return new Map(Array.zip(rules, baselines));
});

/** One ratchet's baseline as the commit `base` holds it. */
const committedBaseline = Effect.fn('committedBaseline')(function* ({
  base,
  rule,
  inherited,
}: CommittedBaselineInput): Effect.fn.Return<Baseline, InputUnreadable> {
  const name = baseBaselineName({ base, rule });
  const lines = yield* gitLines({ args: ['show', name], inherited });

  return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Baseline))(lines.join('\n')).pipe(
    Effect.mapError((error) => new InputUnreadable({ path: name, reason: error.message })),
  );
});
