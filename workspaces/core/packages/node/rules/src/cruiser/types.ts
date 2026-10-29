import type { Severity } from '@mechane/rule-shapes';

/** A rule of `.dependency-cruiser.cjs`: its name, the comment that teaches its fix, its severity and its edges. */
export type CruiserEntry = {
  readonly name: string;
  readonly comment: string;
  readonly severity: Severity;
  readonly from: Readonly<Record<string, unknown>>;
  readonly to: Readonly<Record<string, unknown>>;
};

/** A family's rule as dependency-cruiser takes it: the subject that names it, and the edges it forbids. */
export type FamilyRule = {
  readonly subject: string;
  readonly from: CruiserEntry['from'];
  readonly to: CruiserEntry['to'];
};
