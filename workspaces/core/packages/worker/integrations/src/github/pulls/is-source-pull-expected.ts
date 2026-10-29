import { Option } from 'effect';
import type { GitHubPull } from './schemas.ts';

type IsSourcePullExpectedInput = {
  readonly pull: GitHubPull;
  readonly commit: string;
  readonly branch: string;
  readonly baseBranch: string;
  readonly body: string;
};

/** A matching branch alone is insufficient: draft state, commit, base and source marker must agree. */
export function isSourcePullExpected({ pull, commit, branch, baseBranch, body }: IsSourcePullExpectedInput): boolean {
  if (!pull.isDraft || pull.head.sha !== commit || pull.head.reference !== branch) {
    return false;
  }

  if (Option.isNone(pull.body)) {
    return false;
  }

  return pull.base.reference === baseBranch && pull.body.value === body;
}
