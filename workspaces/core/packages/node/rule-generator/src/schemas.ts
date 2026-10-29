import { Schema } from 'effect';

/** The id an ast-grep rule file declares, which its registry entry's name and each of its matches name. */
export const AstGrepRuleId = Schema.String.pipe(Schema.brand('AstGrepRuleId'));

export type AstGrepRuleId = typeof AstGrepRuleId.Type;

/**
 * The fields of an ast-grep rule file the registry reads: its id, severity and message, the files it scans and skips,
 * and its fix, which `ast-grep scan -U` applies.
 */
export const RuleFileFields = Schema.Struct({
  id: AstGrepRuleId,
  severity: Schema.String,
  message: Schema.String,
  files: Schema.Array(Schema.String),
  /** The files it skips; absent when it skips none of the files it scans. */
  ignores: Schema.OptionFromOptionalKey(Schema.Array(Schema.String)),
  /** The rewrite of each match; absent when the fix needs a person. */
  fix: Schema.OptionFromOptionalKey(Schema.String),
});

export type RuleFileFields = typeof RuleFileFields.Type;
