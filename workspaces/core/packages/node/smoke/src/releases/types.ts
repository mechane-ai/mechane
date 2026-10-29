import type { ReleaseManifest } from '@mechane/protocol';
import type { CliRefusal } from '@mechane/testing';
import type { Option } from 'effect';
import type { UpdateReport } from './schemas.ts';

/** A release built for this machine: the folder of its files, its manifest, and its binary for this machine. */
export type HostRelease = {
  readonly folder: string;
  readonly manifest: ReleaseManifest;
  readonly binary: ReleaseManifest['binaries'][string];
};

/** The scenario's folder, the release install.sh installs there, and the later one the update installs. */
export type HostReleases = {
  readonly folder: string;
  readonly installed: HostRelease;
  readonly published: HostRelease;
};

/** How install.sh exited, null when a signal ended it, and the names it left in the folder it installs into. */
export type RefusedInstall = {
  /** The script's exit status, none when a signal ended it. */
  readonly status: Option.Option<number>;
  readonly left: ReadonlyArray<string>;
};

/** The binary's release line, as `--version` prints it, and the SHA-256 of its bytes. */
export type BinaryReport = { readonly releaseLine: string; readonly sha256: string };

/**
 * What install.sh did with the corrupted release, what each update run reported, and what the binary reported after the
 * refused update and after the update.
 */
export type UpdateRuns = {
  readonly installRefusal: RefusedInstall;
  readonly refused: CliRefusal;
  readonly kept: BinaryReport;
  readonly checked: UpdateReport;
  readonly updated: UpdateReport;
  readonly replaced: BinaryReport;
  readonly repeated: UpdateReport;
};
