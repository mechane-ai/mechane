import { boundedText, BYTES_PER_KIBIBYTE, EXECUTION_VARIABLE_NAME_PATTERN } from '@mechane/records';
import { Schema } from 'effect';

const VARIABLE_MAX_BYTES = 64 * BYTES_PER_KIBIBYTE;
const NamePattern = Schema.isPattern(EXECUTION_VARIABLE_NAME_PATTERN);
const VariableName = Schema.String.check(NamePattern);
const VariableValue = boundedText({ maxBytes: VARIABLE_MAX_BYTES });

/** Trusted execution transport only. Values stay out of execution rows, receipts, and workspace archives. */
export const ExecutionEnvironment = Schema.Struct({
  variables: Schema.Record(VariableName, VariableValue),
  secrets: Schema.Record(VariableName, Schema.RedactedFromValue(VariableValue)),
});

export type ExecutionEnvironment = typeof ExecutionEnvironment.Type;

/** An observation carries no credentials; submission supplies the current owner's environment. */
export const OptionalExecutionEnvironment = Schema.OptionFromNullOr(ExecutionEnvironment);

/** The command is not running on its guest and requires a new authorized submission. */
export const ExecutionEnvironmentRequired = Schema.TaggedStruct('ExecutionEnvironmentRequired', {});
export type ExecutionEnvironmentRequired = typeof ExecutionEnvironmentRequired.Type;
