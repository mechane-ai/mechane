import { baselinePath } from '../ratchets/baseline-path.ts';

/** A commit, and the rule whose baseline it holds. */
type BaseBaselineNameInput = { readonly base: string; readonly rule: string };

/** The git object name of a rule's baseline at the commit `base`, `<commit>:./<path>`, which `git show` reads. */
export function baseBaselineName({ base, rule }: BaseBaselineNameInput): string {
  const path = baselinePath({ rule });

  return `${base}:./${path}`;
}
