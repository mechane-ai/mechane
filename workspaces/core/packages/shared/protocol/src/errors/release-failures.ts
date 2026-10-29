import { ReleaseFileNotFound, ReleasesBucketUnavailable } from './errors.ts';

/** The failures of a read of a release file: no release published it, or the releases bucket did not answer. */
export const RELEASE_FAILURES = [ReleaseFileNotFound, ReleasesBucketUnavailable] as const;

/** A failure to serve a release file: no release published it, or the releases bucket did not answer. */
export type ReleaseFailure = (typeof RELEASE_FAILURES)[number]['Type'];
