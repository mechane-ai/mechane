import { fileURLToPath } from 'node:url';

/** The local stack and release packager consume the same built Worker module. */
export const WORKER_BUNDLE = fileURLToPath(new URL('../../../worker/app/dist/worker.js', import.meta.url));
const CONSOLE_URL: Readonly<URL> = new URL('../../../browser/console/dist/console.json', import.meta.url);
/** The built inventory consumed by both installation formats. */
export const CONSOLE_BUNDLE = fileURLToPath(CONSOLE_URL);
