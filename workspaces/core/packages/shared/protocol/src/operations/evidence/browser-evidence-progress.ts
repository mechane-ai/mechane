import { BrowserProgress } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import { EvidenceArtifact } from './schemas.ts';

/** The native action receipt and its separately durable capture publication share one response. */
export const BrowserEvidenceProgress = Schema.Struct({
  progress: BrowserProgress,
  /** Absent for observations and browser actions that do not create durable media. */
  evidence: Schema.OptionFromNullOr(EvidenceArtifact),
});

export type BrowserEvidenceProgress = typeof BrowserEvidenceProgress.Type;
