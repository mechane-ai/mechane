import { RELEASE } from '@mechane/protocol';
import type { LocalTarget } from '@mechane/stack';

type LocalArtifactNameInput = { readonly target: LocalTarget };

/** Keeps each host archive distinct within the immutable release assets. */
export function localArtifactName({ target }: LocalArtifactNameInput): string {
  return `mechane-local-v${RELEASE}-${target}.tar.gz`;
}
