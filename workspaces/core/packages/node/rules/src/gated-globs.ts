import { FixBehavior, RuleTool } from '@mechane/rule-shapes';
import type { RestrictedRule, Rule } from '@mechane/rule-shapes';
import { CONTRACTS } from './contracts.ts';
import { REGISTERED_RULES } from './registered-rules.ts';

/** The fix behaviors whose sweep leaves the unexercised paths as they are, since only the smoke proves them (TS-07). */
const GATED_BEHAVIORS: ReadonlySet<FixBehavior> = new Set([FixBehavior.FieldNames, FixBehavior.Restructure]);

/** A rule's name, as a sweep or a normalizer names it. */
type GatedGlobsInput = { readonly rule: string };

/**
 * The globs of the code the smoke cannot reach, which a sweep or a normalizer of `rule` leaves as they are. It leaves
 * them when an entry of that name changes field names or restructures, since only the live release verification proves
 * such a fix there (TS-07). A rule whose fix keeps every bundle equal leaves none.
 */
export function gatedGlobs({ rule }: GatedGlobsInput): ReadonlyArray<string> {
  const isGatedEntry: (registered: Exclude<Rule, RestrictedRule>) => boolean = ({ name, behavior }) =>
    name === rule && GATED_BEHAVIORS.has(behavior);

  const isGated = REGISTERED_RULES.map(({ rule: registered }) => registered)
    .filter((registered) => registered.tool !== RuleTool.Restricted)
    .some(isGatedEntry);

  if (!isGated) {
    return [];
  }

  return CONTRACTS['rule-registry'].values.unexercised;
}
