import { Effect } from 'effect';
import { BASE_BRANCH } from '../constants.ts';
import { InputUnreadable } from '../errors.ts';
import { gitLines } from './git-lines.ts';

/** The branch whose merge base with `HEAD` a command starts from, and the variables git inherits. */
type MergeBaseInput = { readonly baseBranch: string; readonly inherited: Readonly<Record<string, string>> };

/**
 * The commit where `HEAD` left `baseBranch`, which the changed set and the ratchets' baselines start from. A clone of
 * one branch has no `main`, so a base that names no commit says how to name the branch this one was cut from.
 */
export const mergeBase = Effect.fn('mergeBase')(function* ({
  baseBranch,
  inherited,
}: MergeBaseInput): Effect.fn.Return<string, InputUnreadable> {
  /** The failure that says which variable names the branch this one was cut from. */
  const unbased: (failure: InputUnreadable) => InputUnreadable = ({ path, reason }) =>
    new InputUnreadable({ path, reason: `${reason}; set ${BASE_BRANCH.variable} to the branch this one was cut from` });

  const lines = yield* gitLines({ args: ['merge-base', 'HEAD', baseBranch], inherited }).pipe(Effect.mapError(unbased));

  return lines.join('');
});
