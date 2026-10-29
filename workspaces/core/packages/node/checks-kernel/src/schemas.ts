import { Schema } from 'effect';

/** One finding of `oxlint -f json`, with the line of its first label. */
export const OxlintDiagnostic = Schema.Struct({
  /** The rule as `plugin(rule)`, such as `eslint(no-console)`; absent from a parse error or an unused directive. */
  code: Schema.OptionFromOptionalKey(Schema.String),
  message: Schema.String,
  /** The fix the rule suggests, which a restricted entry's message fills; absent when the rule suggests none. */
  help: Schema.OptionFromOptionalKey(Schema.String),
  filename: Schema.String,
  labels: Schema.Array(Schema.Struct({ span: Schema.Struct({ line: Schema.Int }) })),
});

export type OxlintDiagnostic = typeof OxlintDiagnostic.Type;

/** What `oxlint -f json` prints. */
export const OxlintReport = Schema.Struct({ diagnostics: Schema.Array(OxlintDiagnostic) });

export type OxlintReport = typeof OxlintReport.Type;

/**
 * A baseline as its file holds it: how many findings of the rule each file may keep, by its path relative to the
 * workspace. A file it does not list keeps none.
 */
export const Baseline = Schema.Record(Schema.String, Schema.Int.check(Schema.isGreaterThan(0)));

export type Baseline = typeof Baseline.Type;
