import { Duration } from 'effect';

/**
 * The parts of the scenario's folder: its prefix in the state folder, the later release with a corrupted binary, the
 * folder install.sh installs into, and the refused install's. Each release's own files are in a folder named for it.
 */
export const ScenarioFolder = {
  Prefix: 'releases-',
  Tampered: 'tampered',
  Install: 'bin',
  RefusedInstall: 'refused-bin',
} as const;

/** How long install.sh may take to download and check a binary of tens of megabytes. */
export const INSTALL_TIMEOUT = Duration.minutes(1);
