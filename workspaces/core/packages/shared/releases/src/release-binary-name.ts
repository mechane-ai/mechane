import type { CliTarget } from './constants.ts';

type ReleaseBinaryNameInput = { readonly target: CliTarget };

/** The public asset filename for a supported CLI target, matching the files uploaded by release publication. */
export function releaseBinaryName({ target }: ReleaseBinaryNameInput): string {
  return `mechane-${target}`;
}
