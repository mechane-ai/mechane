import {
  configurationName,
  FileUnwritable,
  InputUnreadable,
  LINT_TIMEOUT,
  OXLINT,
  OxlintReport,
  removePath,
  ruleKey,
  toolOutput,
  WORKSPACE_FOLDER,
} from '@mechane/checks-kernel';
import type { ChecksFailure } from '@mechane/checks-kernel';
import { CONTRACTS } from '@mechane/rules';
import { Effect, Schema } from 'effect';
import type { Scope } from 'effect';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Measurement } from './types.ts';

/**
 * Every rule oxlint knows, as `oxlint --rules -f json` lists them: its plugin, its name, its category and the kind of
 * fix it offers, such as `fixable_fix` or `none`.
 */
const RuleList = Schema.Array(
  Schema.Struct({ scope: Schema.String, value: Schema.String, category: Schema.String, fix: Schema.String }),
);

type RuleList = typeof RuleList.Type;

/**
 * The configuration the measuring run writes beside .oxlintrc.json, whose override paths resolve from its own folder,
 * and removes once oxlint has read it.
 */
const MEASURE_CONFIGURATION = join(WORKSPACE_FOLDER, '.oxlintrc.measure.json');

/** The kinds of fix oxlint reports for a rule whose fix `oxlint --fix` applies, which the registry calls oxlint's. */
const SAFE_FIXES: ReadonlySet<string> = new Set([
  'fixable_fix',
  'conditional_fix',
  'fixable_safe_fix_or_suggestion',
  'conditional_safe_fix_or_suggestion',
]);

/** What the oxlint run of a measurement found. */
type LintMeasurement = Pick<Measurement, 'counts' | 'categorized' | 'fixable'>;

type RunOxlintInput<S> = {
  readonly args: ReadonlyArray<string>;
  readonly schema: S;
  readonly inherited: Readonly<Record<string, string>>;
};

/** Rules as `oxlint --rules` lists them. */
type RuleNamesInput = { readonly rules: RuleList };

type MeasureTreeInput = { readonly text: string; readonly inherited: Readonly<Record<string, string>> };

/** Runs the workspace's oxlint with the measuring configuration and decodes the JSON it prints. */
const runOxlint = Effect.fn('runOxlint')(function* <S extends Schema.Codec<unknown, unknown>>({
  args,
  schema,
  inherited,
}: RunOxlintInput<S>): Effect.fn.Return<S['Type'], InputUnreadable> {
  const { stdout, stderr } = yield* toolOutput({
    command: OXLINT,
    args: ['-c', MEASURE_CONFIGURATION, ...args],
    inherited,
    timeout: LINT_TIMEOUT,
  });

  /** The failure of an answer that does not decode, with what oxlint wrote to standard error. */
  const unreadableAnswer: (error: Schema.SchemaError) => InputUnreadable = (error) =>
    new InputUnreadable({ path: OXLINT, reason: `${error.message}\n${stderr}` });

  return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(schema))(stdout).pipe(
    Effect.mapError(unreadableAnswer),
  );
});

/**
 * Writes the measuring configuration beside .oxlintrc.json until the measurement ends, and asks oxlint which rules its
 * categories hold and what each rule finds, by the key its findings count under.
 */
export const measureTree = Effect.fn('measureTree')(function* ({
  text,
  inherited,
}: MeasureTreeInput): Effect.fn.Return<LintMeasurement, ChecksFailure, Scope.Scope> {
  const categories: ReadonlySet<string> = new Set(CONTRACTS['code-lint-suppressions'].values.oxlint.categories);

  yield* Effect.acquireRelease(
    Effect.tryPromise({
      try: () => writeFile(MEASURE_CONFIGURATION, text),
      catch: (cause) => new FileUnwritable({ path: MEASURE_CONFIGURATION, reason: String(cause) }),
    }),
    () => removePath({ path: MEASURE_CONFIGURATION }),
  );

  const known = yield* runOxlint({ args: ['--rules', '-f', 'json'], schema: RuleList, inherited });

  const report = yield* runOxlint({
    args: ['--threads=2', '-f', 'json', WORKSPACE_FOLDER],
    schema: OxlintReport,
    inherited,
  });

  const groups = Map.groupBy(report.diagnostics, (diagnostic) => ruleKey({ diagnostic }));

  /** The names a configuration gives oxlint's rules, such as `typescript/array-type`. */
  const ruleNames: (input: RuleNamesInput) => ReadonlySet<string> = ({ rules }) =>
    new Set(rules.map(({ scope, value }) => configurationName({ plugin: scope, rule: value })));

  return {
    counts: new Map([...groups].map(([key, group]) => [key, group.length])),
    categorized: ruleNames({ rules: known.filter(({ category }) => categories.has(category)) }),
    fixable: ruleNames({ rules: known.filter(({ fix }) => SAFE_FIXES.has(fix)) }),
  };
}, Effect.scoped);
