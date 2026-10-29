/** The targets a release compiles the CLI for, each named `<platform>-<arch>` as Node and Bun name them. */
export const CliTarget = {
  LinuxX64: 'linux-x64',
  LinuxArm64: 'linux-arm64',
  DarwinArm64: 'darwin-arm64',
  DarwinX64: 'darwin-x64',
} as const;

export type CliTarget = (typeof CliTarget)[keyof typeof CliTarget];

/**
 * The revision of the source a release was built from, as `git describe` names it, such as `v0.1.0` or `623e228f0a1b`:
 * letters, digits, dots, underscores and hyphens, which install.sh reads as text.
 */
export const REVISION_PATTERN = /^[0-9A-Za-z._-]+$/;

/** A release as semantic versioning writes it, such as `0.1.0` or `0.2.0-rc.1`. */
export const RELEASE_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/**
 * The parts of the release bucket's keys: `cli/latest.json`, and below each release's own folder `cli/v<release>/` its
 * `manifest.json` and its binary `mechane-<target>` for each target. A deployment serves each key at `/<key>`.
 */
export const ReleaseKey = {
  Latest: 'cli/latest.json',
  Folder: 'cli/v',
  Manifest: '/manifest.json',
  Binary: '/mechane-',
} as const;

/** The path of the install script a deployment serves, which installs the release its latest manifest names. */
export const INSTALL_SCRIPT_PATH = '/install.sh';

/** The variable that names the folder `install.sh` installs the binary to; `~/.local/bin` when it is unset. */
export const INSTALL_FOLDER_VARIABLE = 'MECHANE_INSTALL_FOLDER';
