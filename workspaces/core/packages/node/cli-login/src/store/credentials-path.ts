import { join } from 'node:path';
import type { ConfigurationRootInput } from './types.ts';

/** The CLI's folder below the configuration root, which only its owner may enter. */
const CONFIGURATION_FOLDER = 'mechane';

/** The saved login, the one file the CLI reads back. */
const CREDENTIALS_FILE = 'credentials.json';

/** The saved login's file below the configuration root. */
export function credentialsPath({ configurationRoot }: ConfigurationRootInput): string {
  return join(configurationRoot, CONFIGURATION_FOLDER, CREDENTIALS_FILE);
}
