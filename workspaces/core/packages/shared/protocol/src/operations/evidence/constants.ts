import { BYTES_PER_KIBIBYTE, BYTES_PER_MEBIBYTE } from '@mechane/records';

/** Only explicit screenshots and recordings consume durable capture storage. */
export const EvidenceKind = { Screenshot: 'screenshot', Recording: 'recording' } as const;
export type EvidenceKind = (typeof EvidenceKind)[keyof typeof EvidenceKind];

/** Only ready captures may serve media; pending and failed captures retain their receipts. */
export const EvidenceStatus = { Pending: 'pending', Ready: 'ready', Failed: 'failed' } as const;
export type EvidenceStatus = (typeof EvidenceStatus)[keyof typeof EvidenceStatus];

/** An upload cannot reserve more bytes than this for one immutable capture. */
export const EVIDENCE_ARTIFACT_MAX_BYTES = 100 * BYTES_PER_MEBIBYTE;
/** Staged chunks count toward this limit before an artifact becomes readable. */
export const EVIDENCE_MECH_MAX_BYTES = 1024 * BYTES_PER_MEBIBYTE;
/** Pending and failed receipts count toward the same lifetime capture limit. */
export const EVIDENCE_MECH_MAX_ARTIFACTS = 1024;
/** Each list request reads at most this many capture receipts. */
export const EVIDENCE_PAGE_ARTIFACTS = 50;
/** Capture metadata remains bounded independently of the media payload. */
export const EVIDENCE_TEXT_MAX_BYTES = 4 * BYTES_PER_KIBIBYTE;
