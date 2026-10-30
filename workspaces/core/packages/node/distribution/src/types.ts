import type { DistributionMode } from './constants.ts';
import type { Artifact, ArtifactReceipt } from './schemas.ts';

/** The chosen output folder and the environment allowed into build tools. */
export type DistributionSettings = {
  readonly mode: DistributionMode;
  readonly folder: string;
  readonly inherited: Readonly<Record<string, string>>;
};

/** Settings shared by the distribution command implementations. */
export type DistributionInput = { readonly settings: DistributionSettings };
/** A local artifact or source file selected by the caller. */
export type PathInput = { readonly path: string };
/** The measured size and SHA-256 digest of a regular file. */
export type FileDigest = Omit<Artifact, 'name'>;
/** An offline module staging result that cannot be published as a release. */
export type PreviewResult = { readonly folder: string; readonly is_preview: true };
/** The result printed by a release command or an offline module preview. */
export type DistributionResult = ArtifactReceipt | PreviewResult;
