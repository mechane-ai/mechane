import type { MachineId, RecordId } from '@mechane/records';
import { renamedWireStruct } from '@mechane/records';
import { ExecutionTiming, GuestStatus, MachineStartup, STARTUP_MAX_STEPS, StartupPhase } from '@mechane/sandbox-wire';
import type { StartupFailure, StartupFailureObservation, StartupProgress } from '@mechane/sandbox-wire';
import { decodeFirst } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import type { DateTime } from 'effect';
import { Duration, Option, Schema } from 'effect';

const StoredStartup = Schema.Struct({ startup: Schema.fromJsonString(MachineStartup) });
const RETAINED_STARTUPS = 8;

const TimingRow = renamedWireStruct({
  fields: {
    executionId: ExecutionTiming.to.fields.executionId,
    claimedAt: Schema.DateTimeUtcFromMillis,
    dispatchedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
    settledAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
    duration: Schema.OptionFromNullOr(Schema.DurationFromMillis),
  },
  renames: {
    executionId: 'id',
    claimedAt: 'claimed_at_ms',
    dispatchedAt: 'dispatched_at_ms',
    settledAt: 'settled_at_ms',
    duration: 'duration_ms',
  },
});

type Identity = { readonly machineId: MachineId };
type BeginInput = Identity & { readonly deadlineAt: DateTime.Utc; readonly now: DateTime.Utc };
type PhaseInput = Identity & { readonly phase: StartupProgress['phase']; readonly now: DateTime.Utc };
type GuestInput = Identity & { readonly guest: GuestStatus; readonly now: DateTime.Utc };

type RestorationProgress = {
  readonly generation: RecordId;
  readonly source: 'archive' | 'native';
  readonly bytes: number;
  readonly parts: number;
  readonly copiedParts: number;
};

type RestoreInput = Identity & { readonly restoration: RestorationProgress; readonly now: DateTime.Utc };
type SaveInput = { readonly report: MachineStartup };

type FailureInput = Identity & { readonly failure: StartupFailure; readonly now: DateTime.Utc };
type WorkInput = Identity & { readonly milliseconds: number; readonly phase: StartupProgress['phase'] };

/** Startup metadata shares the machine identity and never contains the execution's command or output. */
export function startupRecords({ sql }: RecordsInput) {
  const codec = Schema.fromJsonString(MachineStartup);

  function read({ machineId }: Identity): Option.Option<MachineStartup> {
    const cursor = sql.exec('SELECT startup FROM machines WHERE id = ? AND startup IS NOT NULL', machineId);
    const row = decodeFirst({ cursor, schema: StoredStartup });

    return Option.map(row, (value) => value.startup);
  }

  function save({ report }: SaveInput): void {
    const json = Schema.encodeSync(codec)(report);

    sql.exec('UPDATE machines SET startup = ? WHERE id = ?', json, report.machineId);
  }

  function beginStartup({ machineId, deadlineAt, now }: BeginInput): void {
    const existing = read({ machineId });

    if (Option.isSome(existing)) {
      return;
    }

    const empty = Option.none();

    save({
      report: {
        machineId,
        lastFailure: empty,
        deadlineAt,
        guest: empty,
        restoration: empty,
        progress: {
          phase: StartupPhase.Container,
          startedAt: now,
          updatedAt: now,
          failure: empty,
          steps: [{ phase: StartupPhase.Container, tool: empty, startedAt: now, duration: empty }],
        },
      },
    });
    sql.exec(
      "UPDATE machines SET startup = NULL WHERE startup IS NOT NULL AND id NOT IN (SELECT id FROM machines WHERE startup IS NOT NULL ORDER BY rowid DESC LIMIT ?) AND id NOT IN (SELECT id FROM machines WHERE json_extract(startup, '$.last_failure') IS NOT NULL ORDER BY rowid DESC LIMIT 1)",
      RETAINED_STARTUPS,
    );
  }

  function advanceStartup({ machineId, phase, now }: PhaseInput): void {
    const found = read({ machineId });

    if (Option.isNone(found) || found.value.progress.phase === phase) {
      return;
    }

    const report = found.value;
    const empty = Option.none();
    const step = { phase, tool: empty, startedAt: now, duration: empty };
    const steps = [...report.progress.steps, step].slice(-STARTUP_MAX_STEPS);

    save({ report: { ...report, progress: { ...report.progress, phase, failure: empty, updatedAt: now, steps } } });
  }

  function recordStartupWork({ machineId, phase, milliseconds }: WorkInput): void {
    const found = read({ machineId });

    if (Option.isNone(found)) {
      return;
    }

    const report = found.value;

    const steps = report.progress.steps.map((step) => {
      if (step.phase !== phase) {
        return step;
      }

      const previous = Option.getOrElse(step.duration, () => Duration.zero);
      const bounded = Math.max(0, milliseconds);
      const elapsed = Duration.millis(bounded);
      const total = Duration.sum(previous, elapsed);
      const duration = Option.some(total);

      return { ...step, duration };
    });

    save({ report: { ...report, progress: { ...report.progress, steps } } });
  }

  function observeGuestStartup({ machineId, guest, now }: GuestInput): void {
    const found = read({ machineId });

    if (Option.isNone(found)) {
      return;
    }

    const report = found.value;
    const guestCodec = Schema.fromJsonString(GuestStatus);
    const encodeGuest = Schema.encodeSync(guestCodec);
    const previous = Option.map(report.guest, encodeGuest);
    const encoded = encodeGuest(guest);

    if (Option.contains(previous, encoded)) {
      return;
    }

    const observation = Option.some(guest);

    save({ report: { ...report, guest: observation, progress: { ...report.progress, updatedAt: now } } });
  }

  function observeRestoration({ machineId, restoration, now }: RestoreInput): void {
    const found = read({ machineId });

    if (Option.isNone(found)) {
      return;
    }

    const report = found.value;

    const observation = Option.some(restoration);
    const failure = Option.none();

    save({
      report: { ...report, restoration: observation, progress: { ...report.progress, failure, updatedAt: now } },
    });
  }

  function failStartup({ machineId, failure, now }: FailureInput): void {
    const found = read({ machineId });

    if (Option.isNone(found) || Option.isSome(found.value.progress.failure)) {
      return;
    }

    const report = found.value;

    const lastFailure = Option.some({ machineId, phase: report.progress.phase, code: failure, at: now });
    const failed = Option.some(failure);

    save({ report: { ...report, lastFailure, progress: { ...report.progress, failure: failed, updatedAt: now } } });
  }

  function latestStartup(): Option.Option<MachineStartup> {
    const cursor = sql.exec('SELECT startup FROM machines WHERE startup IS NOT NULL ORDER BY rowid DESC LIMIT 1');
    const row = decodeFirst({ cursor, schema: StoredStartup });

    return Option.map(row, (value) => value.startup);
  }

  function latestStartupFailure(): Option.Option<StartupFailureObservation> {
    const cursor = sql.exec(
      "SELECT startup FROM machines WHERE json_extract(startup, '$.last_failure') IS NOT NULL ORDER BY rowid DESC LIMIT 1",
    );

    const row = decodeFirst({ cursor, schema: StoredStartup });

    return Option.flatMap(row, (value) => value.startup.lastFailure);
  }

  function latestExecutionTiming(): Option.Option<ExecutionTiming> {
    const cursor = sql.exec(
      'SELECT id, claimed_at_ms, dispatched_at_ms, settled_at_ms, duration_ms FROM executions ORDER BY rowid DESC LIMIT 1',
    );

    return decodeFirst({ cursor, schema: TimingRow });
  }

  return {
    beginStartup,
    advanceStartup,
    recordStartupWork,
    observeGuestStartup,
    observeRestoration,
    failStartup,
    latestStartup,
    latestExecutionTiming,
    latestStartupFailure,
  };
}
