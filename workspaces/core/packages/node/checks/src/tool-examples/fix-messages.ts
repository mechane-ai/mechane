import {
  AST_GREP,
  AST_GREP_CONFIGURATION,
  LINT_TIMEOUT,
  readText,
  toolOutput,
  WORKSPACE_FOLDER,
  writeTextFile,
} from '@mechane/checks-kernel';
import type { ChecksFailure } from '@mechane/checks-kernel';
import { RuleFix, RuleTool } from '@mechane/rule-shapes';
import type { AstGrepRule } from '@mechane/rule-shapes';
import { REGISTERED_RULES } from '@mechane/rules';
import { Array, Effect } from 'effect';
import type { Scope } from 'effect';
import { join } from 'node:path';
import { examplesFolder } from './examples-folder.ts';
import { fixMessage } from './fix-message.ts';
import type { FixExample } from './types.ts';

/** The authored rules and their utilities, which a run of the examples reads by their absolute paths. */
const RuleFolder = { Rules: 'lint/ast-grep/rules', Utilities: 'lint/ast-grep/utils' } as const;

/** The end of each example's file name: a schemas file, which every fixing rule's file globs take. */
const EXAMPLE_SUFFIX = '.schemas.ts';

type FixMessagesInput = { readonly inherited: Readonly<Record<string, string>> };

/** A rule with a fix, the folder its examples are written to, and the variables ast-grep inherits. */
type RuleFixMessagesInput = {
  readonly rule: AstGrepRule;
  readonly folder: string;
  readonly inherited: Readonly<Record<string, string>>;
};

/** What one rule's fix leaves of each violation example, where it is not the rule's `fixed` example. */
const ruleFixMessages = Effect.fn('ruleFixMessages')(function* ({
  rule,
  folder,
  inherited,
}: RuleFixMessagesInput): Effect.fn.Return<ReadonlyArray<string>, ChecksFailure> {
  /** A violation example and its `fixed` text, written to the file its place names. */
  const fixExample: (pair: readonly [string, string], place: number) => FixExample = ([violation, fixed], place) => ({
    path: join(folder, `${rule.name}-${String(place)}${EXAMPLE_SUFFIX}`),
    violation,
    fixed,
  });

  const examples = Array.zip(rule.violation, rule.fixed).map(fixExample);
  const paths = examples.map(({ path }) => path);

  yield* Effect.forEach(examples, ({ path, violation }) => writeTextFile({ path, text: violation }), {
    concurrency: 1,
  });
  yield* toolOutput({
    command: AST_GREP,
    args: ['scan', '-c', join(folder, AST_GREP_CONFIGURATION), '-U', '--filter', `^${rule.name}$`, ...paths],
    inherited,
    timeout: LINT_TIMEOUT,
  });

  const texts = yield* Effect.forEach(paths, (path) => readText({ path }), { concurrency: 1 });

  return Array.zip(examples, texts).flatMap(([example, left]) => fixMessage({ name: rule.name, example, left }));
});

/**
 * Each ast-grep rule whose fix leaves a violation example other than as its `fixed` shows (TS-05). The examples are
 * written to a temporary folder whose configuration reads the workspace's rules, and each rule's fix runs over its
 * own.
 */
export const fixMessages = Effect.fn('fixMessages')(function* ({
  inherited,
}: FixMessagesInput): Effect.fn.Return<ReadonlyArray<string>, ChecksFailure, Scope.Scope> {
  const rules = REGISTERED_RULES.map(({ rule }) => rule)
    .filter((rule) => rule.tool === RuleTool.AstGrep)
    .filter(({ fix }) => fix === RuleFix.AstGrep);

  const folder = yield* examplesFolder();

  const configuration = [
    'ruleDirs:',
    `  - ${join(WORKSPACE_FOLDER, RuleFolder.Rules)}`,
    'utilDirs:',
    `  - ${join(WORKSPACE_FOLDER, RuleFolder.Utilities)}`,
    '',
  ];

  yield* writeTextFile({ path: join(folder, AST_GREP_CONFIGURATION), text: configuration.join('\n') });

  const messages = yield* Effect.forEach(rules, (rule) => ruleFixMessages({ rule, folder, inherited }), {
    concurrency: 1,
  });

  return messages.flat();
}, Effect.scoped);
