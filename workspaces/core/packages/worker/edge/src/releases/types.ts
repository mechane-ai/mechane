import type { WorkerSettings } from '@mechane/bindings';
import type { ReleaseFailure } from '@mechane/protocol';
import type { Effect } from 'effect';

export type ServeReleaseInput = { readonly settings: WorkerSettings };

/** Answers a request for the install script or a release file, or fails as the file the request names. */
export type ServeRelease = (input: ServeReleaseInput) => Effect.Effect<Response, ReleaseFailure>;
