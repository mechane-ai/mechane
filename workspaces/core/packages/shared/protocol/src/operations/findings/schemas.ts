import { FindingId, isWellFormedText, RecordText, WatchId, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { WireTime } from '../../schemas.ts';
import {
  FINDING_EVIDENCE_MAX_LINKS,
  FINDING_EVIDENCE_URL_MAX_CHARS,
  FINDING_FINGERPRINT_MAX_CHARS,
  FINDING_KEY_MAX_CHARS,
  FINDING_SUMMARY_MAX_CHARS,
  FindingChange,
  FindingState,
} from './constants.ts';

const FindingKey = Schema.String.check(isWellFormedText, Schema.isBetweenLength(1, FINDING_KEY_MAX_CHARS));

const FindingFingerprint = Schema.String.check(
  isWellFormedText,
  Schema.isBetweenLength(1, FINDING_FINGERPRINT_MAX_CHARS),
);

const FindingSummary = Schema.String.check(isWellFormedText, Schema.isBetweenLength(1, FINDING_SUMMARY_MAX_CHARS));

const EvidenceUrl = Schema.String.check(
  Schema.isPattern(/^https?:\/\/[^\s]+$/),
  Schema.isBetweenLength(1, FINDING_EVIDENCE_URL_MAX_CHARS),
);

const FindingEvidence = Schema.Array(EvidenceUrl).check(Schema.isMaxLength(FINDING_EVIDENCE_MAX_LINKS));

const FINDING_REPORT_FIELDS = {
  watchId: WatchId,
  key: FindingKey,
  state: Schema.Enum(FindingState),
  fingerprint: FindingFingerprint,
  summary: FindingSummary,
  evidence: FindingEvidence,
  windowStart: WireTime,
  windowEnd: WireTime,
} as const;

/** A bounded observation admitted from the scheduled check currently running. */
export const FindingReport = wireStruct({ fields: FINDING_REPORT_FIELDS });

export type FindingReport = typeof FindingReport.Type;

/** Persisted finding fields whose readers do not inherit current admission limits. */
export const FINDING_RECORD_FIELDS = {
  id: FindingId,
  ...FINDING_REPORT_FIELDS,
  key: RecordText,
  fingerprint: RecordText,
  summary: RecordText,
  evidence: Schema.Array(RecordText),
  change: Schema.Enum(FindingChange),
  revision: Schema.Int,
  firstObservedAt: WireTime,
  observedAt: WireTime,
  changedAt: WireTime,
  /** Absent until a notification intent has been queued for this identity. */
  notifiedAt: Schema.OptionFromNullOr(WireTime),
} as const;

/** The latest observation and material revision of a stable finding identity. */
export const Finding = wireStruct({ fields: FINDING_RECORD_FIELDS });

export type Finding = typeof Finding.Type;

/** The current findings returned for a watch. */
export const FindingList = Schema.Struct({ findings: Schema.Array(Finding) });

export type FindingList = typeof FindingList.Type;
