import { fileURLToPath } from 'node:url';

const WORKER_URL: Readonly<URL> = new URL('../../../worker/server/.output/worker.js', import.meta.url);

/** The application has one bundle for local verification and published installations. */
export const WORKER_BUNDLE = fileURLToPath(WORKER_URL);
