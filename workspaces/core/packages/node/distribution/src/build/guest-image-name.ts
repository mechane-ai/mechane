import { RELEASE } from '@mechane/protocol';

/** The OCI archive carries this immutable release tag for Docker and the compute service. */
export function guestImageName(): string {
  return `mechane-guest:v${RELEASE}`;
}
