import { fileURLToPath } from 'node:url';

const WORKER_URL: Readonly<URL> = new URL('../../../worker/sandbox-service/dist/main.js', import.meta.url);

/** The compute service has one bundle for local verification and published installations. */
export const WORKER_BUNDLE = fileURLToPath(WORKER_URL);
