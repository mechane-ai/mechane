import { fileURLToPath } from 'node:url';

/** The local stack and release packager consume the same built Worker module. */
export const WORKER_BUNDLE = fileURLToPath(new URL('../../../worker/app/dist/worker.js', import.meta.url));
