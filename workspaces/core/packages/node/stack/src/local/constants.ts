import { CliTarget } from '@mechane/protocol';

/** celld publishes these targets; its macOS binary requires Apple Silicon. */
export const LocalTarget = {
  DarwinArm64: CliTarget.DarwinArm64,
  LinuxArm64: CliTarget.LinuxArm64,
  LinuxX64: CliTarget.LinuxX64,
} as const;

export type LocalTarget = (typeof LocalTarget)[keyof typeof LocalTarget];

/** The fixed archive paths decoded and verified before an installed runtime starts. */
export const LOCAL_PACKAGE_FILES = {
  manifest: 'local.json',
  worker: 'worker.js',
  guest: 'guest.oci.tar',
  celld: 'celld',
  cli: 'mechane',
  launcher: 'mechane-local',
} as const;
