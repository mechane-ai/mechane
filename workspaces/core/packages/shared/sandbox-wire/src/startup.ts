import { MachineId, RecordId, RecordText, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { ExecutionId } from './schemas.ts';
import { SANDBOX_TOOL_LIMITS } from './tools/constants.ts';

export const IMAGE_STARTUP_SECONDS = 90;
export const WORKSPACE_RESTORE_SECONDS = 300;
const MILLISECONDS_PER_SECOND = 1000;

export const MACHINE_STARTUP_GRACE_MS =
  (IMAGE_STARTUP_SECONDS + SANDBOX_TOOL_LIMITS.startupSeconds + WORKSPACE_RESTORE_SECONDS) * MILLISECONDS_PER_SECOND;

export const StartupPhase = {
  Container: 'container',
  Bootstrap: 'bootstrap',
  Download: 'download',
  Verify: 'verify',
  Extract: 'extract',
  CheckTool: 'check_tool',
  GuestReady: 'guest_ready',
  Transfer: 'transfer',
  Restore: 'restore',
  Ready: 'ready',
} as const;

export type StartupPhase = (typeof StartupPhase)[keyof typeof StartupPhase];

export const StartupFailure = {
  ToolPreparation: 'tool_preparation_failed',
  Provider: 'provider_start_failed',
  Deadline: 'startup_deadline_exceeded',
  Restore: 'workspace_restore_failed',
  GuestLost: 'guest_exited_during_startup',
} as const;

export type StartupFailure = (typeof StartupFailure)[keyof typeof StartupFailure];

export const STARTUP_MAX_STEPS = 48;
const IsFinite = Schema.isFinite();
const AtLeastZero = Schema.isGreaterThanOrEqualTo(0);
const Nonnegative = Schema.Number.check(IsFinite, AtLeastZero);

/** A measured duration describes completed work; a missing duration remains an open interval. */
const StartupStep = wireStruct({
  fields: {
    phase: Schema.Enum(StartupPhase),
    tool: Schema.OptionFromNullOr(RecordText),
    startedAt: Schema.DateTimeUtcFromString,
    duration: Schema.OptionFromNullOr(Schema.DurationFromMillis),
  },
});

export const StartupProgress = wireStruct({
  fields: {
    phase: Schema.Enum(StartupPhase),
    startedAt: Schema.DateTimeUtcFromString,
    updatedAt: Schema.DateTimeUtcFromString,
    steps: Schema.Array(StartupStep).check(Schema.isMaxLength(STARTUP_MAX_STEPS)),
    failure: Schema.OptionFromNullOr(Schema.Enum(StartupFailure)),
  },
});

export type StartupProgress = typeof StartupProgress.Type;

export const GuestStatus = wireStruct({
  fields: { bootstrap: StartupProgress, restoration: Schema.OptionFromNullOr(StartupProgress) },
});

export type GuestStatus = typeof GuestStatus.Type;

export const StartupFailureObservation = wireStruct({
  fields: {
    machineId: MachineId,
    code: Schema.Enum(StartupFailure),
    phase: Schema.Enum(StartupPhase),
    at: Schema.DateTimeUtcFromString,
  },
});

export type StartupFailureObservation = typeof StartupFailureObservation.Type;

/** Startup evidence is bounded metadata; files, commands, URLs and credentials never enter it. */
export const MachineStartup = wireStruct({
  fields: {
    machineId: MachineId,
    lastFailure: Schema.OptionFromNullOr(StartupFailureObservation),
    deadlineAt: Schema.DateTimeUtcFromString,
    progress: StartupProgress,
    guest: Schema.OptionFromNullOr(GuestStatus),
    restoration: Schema.OptionFromNullOr(
      wireStruct({ fields: { generation: RecordId, bytes: Nonnegative, parts: Schema.Int, copiedParts: Schema.Int } }),
    ),
  },
});

export type MachineStartup = typeof MachineStartup.Type;

export const ExecutionTiming = wireStruct({
  fields: {
    executionId: ExecutionId,
    claimedAt: Schema.DateTimeUtcFromString,
    dispatchedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromString),
    settledAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromString),
    duration: Schema.OptionFromNullOr(Schema.DurationFromMillis),
  },
});

export type ExecutionTiming = typeof ExecutionTiming.Type;
