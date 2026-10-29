import { checkBoundaries } from '@mechane/boundaries';
import {
  heldFindings,
  parsedSources,
  proposedRules,
  raisedCounts,
  ratchetRules,
  standardMessage,
  strayBaselines,
  trackedFiles,
  workspaceMembers,
} from '@mechane/checks-kernel';
import type { CheckInput, ChecksFailure, Finding, InputUnreadable, Member } from '@mechane/checks-kernel';
import { checkLocks } from '@mechane/locks';
import type { ParsedSource } from '@mechane/modules';
import { heldNormalizers, normalizerSites } from '@mechane/normalizers';
import { checkDocuments, checkLayout, checkPins, checkSource, orphanFindings, ownedSites } from '@mechane/owned-rules';
import { RuleTool } from '@mechane/rule-shapes';
import { Effect, Option } from 'effect';
import { distinctFindings } from './distinct-findings.ts';
import { exampleFindings } from './examples/example-findings.ts';

/** The owned check that reports a baseline no ratchet declares. */
const BASELINES_CHECK = 'baselines';

/** What a stray baseline's finding asks for. */
const STRAY_BASELINE_MESSAGE =
  'Delete this baseline, such as `mise run fix` does, since no ratchet declares its rule (AS-05)';

/** One owned check: it reads its inputs and returns every violation it finds. */
type Check = (input: CheckInput) => Effect.Effect<ReadonlyArray<Finding>, ChecksFailure>;

/** The branch whose merge base caps every ratchet's baseline, and the variables the checks' children inherit. */
type RunChecksInput = { readonly baseBranch: string; readonly inherited: Readonly<Record<string, string>> };

/** The members, and every parsed file of theirs. */
type OwnedFindingsInput = { readonly members: ReadonlyArray<Member>; readonly sources: ReadonlyArray<ParsedSource> };

/** Every owned check; each enforces declared values that no installed tool checks. */
const CHECKS: ReadonlyArray<Check> = [checkLayout, checkBoundaries, checkDocuments, checkPins, checkLocks];

/** The findings of the owned rules and of each normalizer not proposed, with each ratchet held to its baseline. */
const ownedFindings = Effect.fn('ownedFindings')(function* ({
  members,
  sources,
}: OwnedFindingsInput): Effect.fn.Return<ReadonlyArray<Finding>, InputUnreadable> {
  const owned = yield* ownedSites({ sources });
  const normalized = yield* normalizerSites({ rules: heldNormalizers(), members, sources });
  const ratchets = ratchetRules().filter(({ tool }) => tool === RuleTool.Owned || tool === RuleTool.Normalizer);

  return yield* heldFindings({
    sites: [...owned, ...normalized],
    ratchets,
    proposed: proposedRules(),
    scope: Option.none(),
  });
});

/**
 * Reads the members and tracked files once, parses each source file once, and runs every owned check on them. It runs
 * each owned rule on its examples, and a normalizer's dry run once its rule is not proposed. It holds each ratchet to
 * its baseline and the merge base's, and finds each stray baseline.
 */
export const runChecks = Effect.fn('runChecks')(function* ({
  baseBranch,
  inherited,
}: RunChecksInput): Effect.fn.Return<ReadonlyArray<Finding>, ChecksFailure> {
  const members = yield* workspaceMembers();
  const files = yield* trackedFiles({ inherited });
  const sources = yield* parsedSources({ members });
  const groups = yield* Effect.forEach(CHECKS, (check) => check({ members, files, sources }), { concurrency: 1 });
  const ratchets = ratchetRules();
  const held = yield* ownedFindings({ members, sources });
  const raised = yield* raisedCounts({ ratchets, baseBranch, inherited });
  const strays = yield* strayBaselines({ ratchets });
  const examples = yield* exampleFindings({ members, inherited });
  const checked = [...groups.flat(), ...orphanFindings({ members, files }), ...checkSource({ sources })];

  /** A check's finding, its message ended with its rule's standard. */
  const standardFinding: (finding: Finding) => Finding = (finding) => ({
    ...finding,
    message: standardMessage({ rule: finding.check, message: finding.message }),
  });

  return distinctFindings({
    findings: [
      ...checked.map(standardFinding),
      ...held,
      ...raised,
      ...examples,
      ...strays.map((path) => ({ check: BASELINES_CHECK, location: path, message: STRAY_BASELINE_MESSAGE })),
    ],
  });
});
