import { ReleaseFileNotFound } from './errors.ts';
import { ReleaseSourceUnavailable } from './release-source.errors.ts';

/** A release file is missing, or its configured source could not serve it. */
export const RELEASE_FAILURES = [ReleaseFileNotFound, ReleaseSourceUnavailable] as const;
