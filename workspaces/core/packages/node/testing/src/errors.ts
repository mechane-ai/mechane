import { Schema } from 'effect';
import { BrowserStep, CliStep, FileStep } from './constants.ts';

/** A check did not pass; it already wrote its name to standard output, and `reason` says what it saw. */
export class CheckFailed extends Schema.TaggedError<CheckFailed>()('CheckFailed', {
  name: Schema.String,
  reason: Schema.String,
}) {}

/** A CLI run did not take the step the scenario expects of it. */
export class CliFailed extends Schema.TaggedError<CliFailed>()('CliFailed', {
  command: Schema.String,
  step: Schema.Enum(CliStep),
  /** The run's exit status, none while it still runs or after a signal ended it. */
  status: Schema.Option(Schema.Int),
  stderr: Schema.String,
}) {}

/** A CLI run wrote an envelope or a record that does not decode as the scenario expects. */
export class CliUndecoded extends Schema.TaggedError<CliUndecoded>()('CliUndecoded', {
  command: Schema.String,
  stderr: Schema.String,
  reason: Schema.String,
}) {}

/** A step of a scenario's browser at a page did not get the answer a person's browser would. */
export class BrowserRefused extends Schema.TaggedError<BrowserRefused>()('BrowserRefused', {
  step: Schema.Enum(BrowserStep),
  url: Schema.URL,
  reason: Schema.String,
}) {}

/** A scenario could not take a step on a file or a folder. */
export class FileStepFailed extends Schema.TaggedError<FileStepFailed>()('FileStepFailed', {
  step: Schema.Enum(FileStep),
  path: Schema.String,
  reason: Schema.String,
}) {}

/** At least one scenario failed; each failure is already written. */
export class ScenariosFailed extends Schema.TaggedError<ScenariosFailed>()('ScenariosFailed', {
  failedScenarios: Schema.Int,
}) {}
