import { fileURLToPath } from 'node:url';

const CORE_URL: Readonly<URL> = new URL('../../../../../', import.meta.url);
const SOURCE_URL: Readonly<URL> = new URL('../../../../../../../', import.meta.url);

/** The product workspace that owns the build tasks and compatibility locks. */
export const CORE_FOLDER = fileURLToPath(CORE_URL);
/** The public repository root that supplies release provenance and notices. */
export const SOURCE_FOLDER = fileURLToPath(SOURCE_URL);
