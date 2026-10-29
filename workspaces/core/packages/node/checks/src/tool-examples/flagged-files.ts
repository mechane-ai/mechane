import { InputUnreadable, LINT_TIMEOUT, OXLINT, OxlintReport, ruleKey, toolOutput } from '@mechane/checks-kernel';
import type { OxlintRule } from '@mechane/rule-shapes';
import { Effect, Schema } from 'effect';

/** A rule, the configuration that runs it alone, its examples' files, and the variables oxlint inherits. */
type FlaggedFilesInput = {
  readonly rule: OxlintRule;
  readonly configuration: string;
  readonly paths: ReadonlyArray<string>;
  readonly inherited: Readonly<Record<string, string>>;
};

/** The files among `paths` in which oxlint, run with the rule's own configuration, reports the rule. */
export const flaggedFiles = Effect.fn('flaggedFiles')(function* ({
  rule,
  configuration,
  paths,
  inherited,
}: FlaggedFilesInput): Effect.fn.Return<ReadonlySet<string>, InputUnreadable> {
  const { stdout, stderr } = yield* toolOutput({
    command: OXLINT,
    args: ['-c', configuration, '-f', 'json', ...paths],
    inherited,
    timeout: LINT_TIMEOUT,
  });

  /** The failure of a report that does not decode, with what oxlint wrote to standard error. */
  const unreadableReport: (error: Schema.SchemaError) => InputUnreadable = (error) =>
    new InputUnreadable({ path: OXLINT, reason: `${error.message}\n${stderr}` });

  const report = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(OxlintReport))(stdout).pipe(
    Effect.mapError(unreadableReport),
  );

  /** Whether oxlint reported the diagnostic for the rule. */
  const isRuleDiagnostic: (diagnostic: OxlintReport['diagnostics'][number]) => boolean = (diagnostic) =>
    ruleKey({ diagnostic }) === rule.name;

  const ruleDiagnostics = report.diagnostics.filter(isRuleDiagnostic);

  return new Set(ruleDiagnostics.map(({ filename }) => filename));
});
