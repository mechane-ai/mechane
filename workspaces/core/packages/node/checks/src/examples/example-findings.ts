import type { ChecksFailure, Finding, Member } from '@mechane/checks-kernel';
import { entryFiles } from '@mechane/normalizers';
import { bannedPhrases } from '@mechane/owned-rules';
import { RuleTool } from '@mechane/rule-shapes';
import { REGISTERED_RULES } from '@mechane/rules';
import { Effect, Record } from 'effect';
import { REGISTRY } from '../constants.ts';
import { rewriteMessages } from '../rewrites/rewrite-messages.ts';
import { fixMessages } from '../tool-examples/fix-messages.ts';
import { oxlintMessages } from '../tool-examples/oxlint-messages.ts';
import { UNEXAMPLED_RULES } from './constants.ts';
import { EXAMPLE_RUNS } from './example-runs.ts';
import { ownedRuleMessages } from './owned-rule-messages.ts';

/** The owned check whose findings report a rule that lacks its examples or misjudges one. */
const EXAMPLES_CHECK = 'rules';

/** The members whose source roots the examples sit below, and the variables ast-grep inherits. */
type ExampleFindingsInput = {
  readonly members: ReadonlyArray<Member>;
  readonly inherited: Readonly<Record<string, string>>;
};

/**
 * Each rule that lacks its examples or misjudges one (TS-05). An owned rule's run must judge each tree as it says, in
 * memory, an oxlint rule each example, and each finding must read as AS-01 says. Each normalizer must leave each
 * rewrite as it shows, and each ast-grep fix each violation as its `fixed` example shows.
 */
export const exampleFindings = Effect.fn('exampleFindings')(function* ({
  members,
  inherited,
}: ExampleFindingsInput): Effect.fn.Return<ReadonlyArray<Finding>, ChecksFailure> {
  const workspace = { members, entries: yield* entryFiles({ members }), phrases: yield* bannedPhrases() };
  const owned = REGISTERED_RULES.map(({ rule }) => rule).filter((rule) => rule.tool === RuleTool.Owned);
  const names: ReadonlySet<string> = new Set(owned.map(({ name }) => name));
  const rewrites = yield* rewriteMessages({ members });
  const fixes = yield* fixMessages({ inherited });
  const oxlint = yield* oxlintMessages({ inherited });

  /** Whether a run or an unexampled rule names no owned rule. */
  const isStale: (name: string) => boolean = (name) => !names.has(name);

  /** What a stale run's or unexampled rule's finding asks for. */
  const staleMessage: (name: string) => string = (name) =>
    `Remove ${name} from the example runs, such as \`'${name}': sourceSitesRun\`, since no owned rule has its name (TS-05)`;

  const stale = [...Record.keys(EXAMPLE_RUNS), ...UNEXAMPLED_RULES].filter(isStale);

  return [
    ...owned.flatMap((rule) => ownedRuleMessages({ rule, workspace })),
    ...rewrites,
    ...fixes,
    ...oxlint,
    ...stale.map(staleMessage),
  ].map((message) => ({ check: EXAMPLES_CHECK, location: REGISTRY, message }));
});
