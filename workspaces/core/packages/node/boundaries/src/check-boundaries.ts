import { decodeFile, writeTextFile } from '@mechane/checks-kernel';
import type { CheckInput, ChecksFailure, Finding } from '@mechane/checks-kernel';
import { MemberManifest, RuleTool } from '@mechane/rule-shapes';
import { REGISTERED_RULES, registeredName } from '@mechane/rules';
import { Effect, Option } from 'effect';
import { CRUISER_CONFIGURATION, MEMBER_MANIFEST, MODULE_GRAPH } from './constants.ts';
import { cruiseRoots } from './cruise-roots.ts';
import { moduleGraph } from './module-graph.ts';
import { packageFindings } from './package-findings.ts';
import type { CruiseViolation } from './schemas.ts';

/** The comment of each dependency-cruiser rule and family, which teaches its fix, by the name the registry gives it. */
const CRUISER_FIXES: ReadonlyMap<string, string> = new Map(
  REGISTERED_RULES.map(({ rule }) => rule)
    .filter((rule) => rule.tool === RuleTool.Cruiser || rule.tool === RuleTool.Manifest)
    .map(({ name, comment }) => [name, comment]),
);

/** A dependency-cruiser rule an import breaks, by its name, and the file the import resolves to. */
type ViolationMessageInput = { readonly rule: string; readonly to: string };

/**
 * Cruises the source roots once. It reports every import that breaks a rule of .dependency-cruiser.cjs, checks every
 * resolved import against the members' manifests, and keeps the module graph for the changed set.
 */
export const checkBoundaries = Effect.fn('checkBoundaries')(function* ({
  members,
}: CheckInput): Effect.fn.Return<ReadonlyArray<Finding>, ChecksFailure> {
  const roots = members.flatMap((member) => member.sourceRoots);
  const { modules, summary } = yield* cruiseRoots({ roots });
  const manifest = yield* decodeFile({ path: MEMBER_MANIFEST, schema: MemberManifest });

  yield* writeTextFile({ path: MODULE_GRAPH, text: JSON.stringify(moduleGraph({ modules })) });

  /** A broken rule's finding at the importing file, whose message teaches the rule's fix. */
  const violationFinding: (violation: CruiseViolation) => Finding = ({ from, to, rule }) => ({
    check: rule.name,
    location: from,
    message: violationMessage({ rule: rule.name, to }),
  });

  return [...summary.violations.map(violationFinding), ...packageFindings({ modules, manifest, members })];
});

/**
 * What a dependency-cruiser finding says: its rule's comment, which teaches the fix, and the import. A rule the
 * registry lacks was written into the configuration by hand.
 */
function violationMessage({ rule, to }: ViolationMessageInput): string {
  const comment = Option.fromNullishOr(CRUISER_FIXES.get(registeredName({ name: rule })));

  if (Option.isNone(comment)) {
    return `Regenerate ${CRUISER_CONFIGURATION}, such as \`mise run fix\` does, since the registry has no ${rule} (AS-03)`;
  }

  return `${comment.value}, since it imports ${to}`;
}
