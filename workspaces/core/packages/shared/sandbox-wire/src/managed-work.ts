import { boundedText, Bytes, BYTES_PER_KIBIBYTE } from '@mechane/records';
import { Duration, Schema } from 'effect';
import { SANDBOX_SERVICE_PREFIX } from './service.ts';

export const MANAGED_WORK_PATH = [SANDBOX_SERVICE_PREFIX, 'managed-work'].join('/');
export const MANAGED_WORK_FINGERPRINT_HEADER = 'x-mechane-work-fingerprint';
export const MANAGED_WORK_MAX_BYTES = 64 * BYTES_PER_KIBIBYTE;
export const ManagedSandboxWorkAction = { Start: 'start', Touch: 'touch', Release: 'release' } as const;

const workIdPattern = Schema.isPattern(/^work_[A-Za-z0-9_-]{1,128}$/u);
const WorkId = Schema.String.check(workIdPattern);
const sessionIdPattern = Schema.isPattern(/^sesn_[A-Za-z0-9_-]{1,128}$/u);
const SessionId = Schema.String.check(sessionIdPattern);
const environmentIdPattern = Schema.isPattern(/^env_[A-Za-z0-9_-]{1,128}$/u);
const EnvironmentId = Schema.String.check(environmentIdPattern);
const WORK_SECRET_MAX_BYTES = 32 * BYTES_PER_KIBIBYTE;
const workSecretMaxBytes = Bytes.make(WORK_SECRET_MAX_BYTES);
const WorkSecret = boundedText({ maxBytes: workSecretMaxBytes });
const WORKER_IDLE_MIN = Duration.seconds(1);
const WORKER_IDLE_MAX = Duration.hours(1);

const workerIdleRangeFilter = Schema.makeFilter((duration: Duration.Duration) => {
  const isAtLeastMin = Duration.isGreaterThanOrEqualTo(duration, WORKER_IDLE_MIN);
  const isAtMostMax = Duration.isLessThanOrEqualTo(duration, WORKER_IDLE_MAX);

  return isAtLeastMin && isAtMostMax;
});

const WorkerIdleDuration = Schema.DurationFromMillis.check(workerIdleRangeFilter);

export const ManagedWorkerSession = Schema.Struct({ environmentId: EnvironmentId, sessionId: SessionId });

export const ManagedWorkerAllocation = Schema.Struct({
  ...ManagedWorkerSession.fields,
  generation: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER })),
});

export const ManagedWorkerClaim = Schema.Struct({
  ...ManagedWorkerSession.fields,
  workId: WorkId,
  workSecret: WorkSecret,
  apiOrigin: Schema.NonEmptyString,
  maxIdle: Schema.optionalKey(WorkerIdleDuration),
});

export type ManagedWorkerClaim = typeof ManagedWorkerClaim.Type;
export type ManagedWorkerClaimWire = typeof ManagedWorkerClaim.Encoded;
