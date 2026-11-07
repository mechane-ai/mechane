import { EvidenceArtifactId } from '@mechane/records';
import { Schema } from 'effect';

/** The admitted mech has no artifact with this identity; foreign owners receive the same failure. */
export class EvidenceNotFound extends Schema.TaggedError<EvidenceNotFound>()('EvidenceNotFound', {
  artifactId: EvidenceArtifactId,
}) {}

/** A known capture has no readable durable media, including pending or failed persistence. */
export class EvidenceUnavailable extends Schema.TaggedError<EvidenceUnavailable>()('EvidenceUnavailable', {
  artifactId: EvidenceArtifactId,
  reason: Schema.String,
}) {}
