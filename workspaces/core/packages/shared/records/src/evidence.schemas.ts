import { Schema } from 'effect';
import { boundedText } from './bounded-text.ts';
import { BYTES_PER_KIBIBYTE, SHA256_PATTERN } from './constants.ts';
import { GitCommit } from './git-commit.schemas.ts';
import { RecordId, RecordText } from './schemas.ts';

/** The capture request fixes this identity before any media is produced. */
export const EvidenceArtifactId = RecordId.pipe(Schema.brand('EvidenceArtifactId'));
export type EvidenceArtifactId = typeof EvidenceArtifactId.Type;

/** Chromium assigns this tab identity; it is valid only on its original live machine. */
export const BrowserTabId = RecordText.pipe(Schema.brand('BrowserTabId'));
export type BrowserTabId = typeof BrowserTabId.Type;

/** A capture names its original machine even after that machine is replaced. */
export const EvidenceMachineId = RecordId.pipe(Schema.brand('EvidenceMachineId'));
export type EvidenceMachineId = typeof EvidenceMachineId.Type;

const EVIDENCE_PROVENANCE_MAX_BYTES = 4 * BYTES_PER_KIBIBYTE;
const EvidenceProvenanceText = boundedText({ maxBytes: EVIDENCE_PROVENANCE_MAX_BYTES });

/** A checkout observation identifies local source, not the revision served by a remote page. */
export const EvidenceProvenance = Schema.TaggedUnion({
  Unknown: { reason: EvidenceProvenanceText },
  ObservedGit: {
    repositoryPath: EvidenceProvenanceText,
    head: GitCommit,
    isDirty: Schema.Boolean,
    /** Absent for clean trees or when untracked files prevent a complete tracked patch fingerprint. */
    dirtyPatchSha256: Schema.OptionFromNullOr(Schema.String.check(Schema.isPattern(SHA256_PATTERN))),
  },
});

export type EvidenceProvenance = typeof EvidenceProvenance.Type;
