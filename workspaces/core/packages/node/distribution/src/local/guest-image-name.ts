import { RELEASE } from '@mechane/protocol';

/** The OCI archive carries this immutable release tag for Docker and celld. */
export function guestImageName(): string {
  return `mechane-guest:v${RELEASE}`;
}
