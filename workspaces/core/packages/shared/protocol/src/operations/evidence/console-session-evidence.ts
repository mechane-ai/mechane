import { wireStruct } from '@mechane/records';
import { InstalledActionOrigin } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import { EvidenceArtifact, EvidencePage } from './schemas.ts';

/** Native capture receipt with the original installed session and work identity when recorded. */
export const ConsoleSessionEvidenceArtifact = wireStruct({
  fields: {
    ...EvidenceArtifact.to.fields,
    /** Absent when the original capture has no recorded installed-work origin. */
    origin: Schema.optionalKey(InstalledActionOrigin),
  },
});

export type ConsoleSessionEvidenceArtifact = typeof ConsoleSessionEvidenceArtifact.Type;

/** One cursor page of private capture receipts for a single authorized session. */
export const ConsoleSessionEvidencePage = wireStruct({
  fields: { ...EvidencePage.to.fields, artifacts: Schema.Array(ConsoleSessionEvidenceArtifact) },
});

export type ConsoleSessionEvidencePage = typeof ConsoleSessionEvidencePage.Type;
