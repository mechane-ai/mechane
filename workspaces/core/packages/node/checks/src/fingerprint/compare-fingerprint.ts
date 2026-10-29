import { CHECKS_PROGRAM, readText, WORKSPACE_FOLDER } from '@mechane/checks-kernel';
import type { Finding, InheritedInput, InputUnreadable } from '@mechane/checks-kernel';
import { writeDiagnostic } from '@mechane/program';
import { Effect } from 'effect';
import { existsSync } from 'node:fs';
import { relative } from 'node:path';
import { GREEN_FINGERPRINT, TOTAL_ROLE } from './constants.ts';
import { fingerprintLines } from './fingerprint-lines.ts';

/** The owned check whose findings ask for the smoke. */
const FINGERPRINT_CHECK = 'fingerprint';

/**
 * Compares the fingerprint with the last green full check's. Each role whose hash differs or that only one side has is
 * a finding, and so is a missing record, so the caller runs the smoke. An equal fingerprint says the smoke is skipped.
 */
export const compareFingerprint = Effect.fn('compareFingerprint')(function* ({
  inherited,
}: InheritedInput): Effect.fn.Return<ReadonlyArray<Finding>, InputUnreadable> {
  const lines = yield* fingerprintLines({ inherited });
  const location = relative(WORKSPACE_FOLDER, GREEN_FINGERPRINT);

  if (!existsSync(GREEN_FINGERPRINT)) {
    return [
      { check: FINGERPRINT_CHECK, location, message: 'Record a fingerprint, such as `mise run check` does (TS-07)' },
    ];
  }

  const recorded = (yield* readText({ path: GREEN_FINGERPRINT })).trim().split('\n');

  /** Whether the recorded fingerprint lacks a line of the current one. */
  const isUnrecorded: (line: string) => boolean = (line) => !recorded.includes(line);
  /** Whether the current fingerprint lacks a line of the recorded one. */
  const isOnlyRecorded: (line: string) => boolean = (line) => !lines.includes(line);
  /** The role a line names, the word before its hash. */
  const lineRole: (line: string) => string = (line) => line.slice(0, line.indexOf(' '));

  /** The finding of a role that differs from the record. */
  const roleFinding: (role: string) => Finding = (role) => ({
    check: FINGERPRINT_CHECK,
    location: role,
    message: `Run the smoke, such as \`mise run check\` does, since the role differs from what ${location} records (TS-07)`,
  });

  // A role whose line only one side holds differs, whether its hash changed or the role came or went.
  const changed = [...lines.filter(isUnrecorded), ...recorded.filter(isOnlyRecorded)];
  const roles = [...new Set(changed.map(lineRole))].filter((role) => role !== TOTAL_ROLE);

  if (roles.length === 0) {
    writeDiagnostic({
      program: CHECKS_PROGRAM,
      line: "the fingerprint equals the last green full check's, so the smoke is skipped",
    });
  }

  return roles.map(roleFinding);
});
