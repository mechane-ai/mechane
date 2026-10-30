import { ReleaseFileNotFound, ReleasesBucketUnavailable } from './errors.ts';
import { ReleaseSourceUnavailable } from './release-source.errors.ts';

/** A release file is missing, or its configured source could not serve it. */
export const RELEASE_FAILURES = [ReleaseFileNotFound, ReleasesBucketUnavailable, ReleaseSourceUnavailable] as const;

/** A release download failure shared by storage adapters and HTTP error encoding. */
export type ReleaseFailure = (typeof RELEASE_FAILURES)[number]['Type'];
