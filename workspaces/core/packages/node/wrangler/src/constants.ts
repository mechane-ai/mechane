import { fileURLToPath } from 'node:url';

/** The Worker module `mise run build:worker` writes: the bytes a production deploy uploads, which the stack serves. */
export const WORKER_BUNDLE = fileURLToPath(new URL('../../../worker/app/dist/worker.js', import.meta.url));

/** The one Wrangler configuration that both Cloudflare and celld deploy. */
export const WRANGLER_CONFIGURATION = fileURLToPath(new URL('../../../worker/app/wrangler.jsonc', import.meta.url));
