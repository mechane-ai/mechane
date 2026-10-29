import { changedFiles } from '@mechane/boundaries';
import { mergeBaselines, runLint } from '@mechane/checks-kernel';
import type { ChecksFailure, Finding } from '@mechane/checks-kernel';
import { appendLocks } from '@mechane/locks';
import { Effect } from 'effect';
import { ChecksCommand } from './constants.ts';
import { compareFingerprint } from './fingerprint/compare-fingerprint.ts';
import { fingerprintLines } from './fingerprint/fingerprint-lines.ts';
import { recordFingerprint } from './fingerprint/record-fingerprint.ts';
import { applyFixes } from './fixers/apply-fixes.ts';
import { applyNormalizers } from './fixers/apply-normalizers.ts';
import { loadChecksSettings } from './load-checks-settings.ts';
import { measureRules } from './measure/measure-rules.ts';
import { runChecks } from './run-checks.ts';
import { tightenBaselines } from './tighten-baselines.ts';
import type { ChecksSettings } from './types.ts';
import { writeLines } from './write-lines.ts';

/** What one command runs with the settings its command line and environment give. */
type CommandRun = (settings: ChecksSettings) => Effect.Effect<ReadonlyArray<Finding>, ChecksFailure>;

/** The lines a command prints as its result. */
type PrintedInput = { readonly lines: Effect.Effect<ReadonlyArray<string>, ChecksFailure> };

/** Writes the lines a command prints as its result; such a command finds nothing. */
const printed = Effect.fn('printed')(function* ({
  lines,
}: PrintedInput): Effect.fn.Return<ReadonlyArray<Finding>, ChecksFailure> {
  writeLines({ lines: yield* lines });

  return [];
});

/**
 * What each command runs with the settings its command line and environment give. A command that prints its result, the
 * fingerprint or the changed set, finds nothing.
 */
const COMMAND_RUNS: Readonly<Record<ChecksCommand, CommandRun>> = {
  [ChecksCommand.Check]: ({ baseBranch, inherited }) => runChecks({ baseBranch, inherited }),
  [ChecksCommand.Lint]: ({ paths, inherited }) => runLint({ paths, inherited }),
  [ChecksCommand.Tighten]: ({ baseBranch, inherited }) => tightenBaselines({ baseBranch, inherited }),
  [ChecksCommand.Merge]: ({ paths }) => mergeBaselines({ paths }),
  [ChecksCommand.Fingerprint]: ({ inherited }) => printed({ lines: fingerprintLines({ inherited }) }),
  [ChecksCommand.Record]: ({ inherited }) => recordFingerprint({ inherited }),
  [ChecksCommand.Compare]: ({ inherited }) => compareFingerprint({ inherited }),
  [ChecksCommand.Changed]: ({ baseBranch, inherited }) => printed({ lines: changedFiles({ baseBranch, inherited }) }),
  [ChecksCommand.Measure]: ({ inherited }) => measureRules({ inherited }),
  [ChecksCommand.Lock]: () => appendLocks(),
  [ChecksCommand.Normalize]: ({ paths }) => applyNormalizers({ paths }),
  [ChecksCommand.Fix]: ({ rule, paths, inherited }) => applyFixes({ rule, paths, inherited }),
};

/** Runs the one command the command line names, with the settings it and the environment give. */
export const runChecksCommand = Effect.fn('runChecksCommand')(function* (): Effect.fn.Return<
  ReadonlyArray<Finding>,
  ChecksFailure
> {
  const settings = yield* loadChecksSettings();

  return yield* COMMAND_RUNS[settings.command](settings);
});
