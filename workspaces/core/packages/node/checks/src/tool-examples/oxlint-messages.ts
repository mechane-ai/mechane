import { WORKSPACE_FOLDER, writeTextFile } from '@mechane/checks-kernel';
import type { ChecksFailure } from '@mechane/checks-kernel';
import { RuleTool } from '@mechane/rule-shapes';
import type { OxlintRule } from '@mechane/rule-shapes';
import { CONTRACTS, REGISTERED_RULES } from '@mechane/rules';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { join } from 'node:path';
import { examplesFolder } from './examples-folder.ts';
import { flaggedFiles } from './flagged-files.ts';
import { oxlintExampleMessages } from './oxlint-example-messages.ts';
import type { OxlintExample } from './types.ts';

/** The compiler configuration the examples' folder holds, which a type-aware rule reads. */
const COMPILER_CONFIGURATION = 'tsconfig.json';

/** The program the examples check in: the workspace's compiler options over every file of their folder. */
const EXAMPLES_PROGRAM = { extends: join(WORKSPACE_FOLDER, 'tsconfig.base.json'), include: ['*.ts'] } as const;

/** The examples load the repository's plugins while configuring each rule on its own. */
const EXAMPLES_SETTINGS = {
  plugins: CONTRACTS['code-lint-suppressions'].values.oxlint.plugins,
  options: { typeAware: true },
} as const;

type OxlintMessagesInput = { readonly inherited: Readonly<Record<string, string>> };

/** An oxlint rule with examples, its place among them, the examples' folder, and the variables oxlint inherits. */
type RuleMessagesInput = {
  readonly rule: OxlintRule;
  readonly place: number;
  readonly folder: string;
  readonly inherited: Readonly<Record<string, string>>;
};

/** What one rule's run over its examples shows: each example it misjudges. */
const ruleMessages = Effect.fn('ruleMessages')(function* ({
  rule,
  place,
  folder,
  inherited,
}: RuleMessagesInput): Effect.fn.Return<ReadonlyArray<string>, ChecksFailure> {
  const prefix = join(folder, String(place));
  const configuration = `${prefix}.json`;

  /** A violation example, written to the file its place names. */
  const violationExample: (text: string, index: number) => OxlintExample = (text, index) => ({
    path: `${prefix}-violation-${String(index)}.ts`,
    text,
    isViolation: true,
  });

  /** An allowed example, written to the file its place names. */
  const allowedExample: (text: string, index: number) => OxlintExample = (text, index) => ({
    path: `${prefix}-allowed-${String(index)}.ts`,
    text,
    isViolation: false,
  });

  const examples = [...rule.violation.map(violationExample), ...rule.allowed.map(allowedExample)];

  yield* writeTextFile({
    path: configuration,
    text: JSON.stringify({ ...EXAMPLES_SETTINGS, rules: { [rule.name]: rule.value } }),
  });
  yield* Effect.forEach(examples, ({ path, text }) => writeTextFile({ path, text }), { concurrency: 1 });

  const flagged = yield* flaggedFiles({ rule, configuration, paths: examples.map(({ path }) => path), inherited });

  return examples.flatMap((example) => oxlintExampleMessages({ name: rule.name, example, flagged }));
});

/**
 * Each oxlint rule that misjudges one of its examples (TS-05): it must flag each violation and pass each allowed
 * example. The examples check in a temporary folder with the workspace's compiler options, and each rule runs alone
 * over its own with type information. A nursery rule that changes in an oxlint release then fails the check (TD-08).
 */
export const oxlintMessages = Effect.fn('oxlintMessages')(function* ({
  inherited,
}: OxlintMessagesInput): Effect.fn.Return<ReadonlyArray<string>, ChecksFailure, Scope.Scope> {
  const rules = REGISTERED_RULES.map(({ rule }) => rule)
    .filter((rule) => rule.tool === RuleTool.Oxlint)
    .filter(({ violation, allowed }) => violation.length + allowed.length > 0);

  const folder = yield* examplesFolder();

  yield* writeTextFile({ path: join(folder, COMPILER_CONFIGURATION), text: JSON.stringify(EXAMPLES_PROGRAM) });

  /** One rule's messages, its examples' files named for its place among the rules. */
  const placedMessages: (rule: OxlintRule, place: number) => Effect.Effect<ReadonlyArray<string>, ChecksFailure> = (
    rule,
    place,
  ) => ruleMessages({ rule, place, folder, inherited });

  const messages = yield* Effect.forEach(rules, placedMessages, { concurrency: 1 });

  return messages.flat();
}, Effect.scoped);
