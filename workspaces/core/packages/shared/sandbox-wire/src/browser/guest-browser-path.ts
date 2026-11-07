import type { EvidenceArtifactId, RecordId } from '@mechane/records';
import { GuestSegment } from '../constants.ts';
import type { BrowserRequestId } from './schemas.ts';

type GuestBrowserPathInput = { readonly machineId: RecordId };

/** Addresses browser commands within a specific guest machine, never a public debugging endpoint. */
export function guestBrowserPath({ machineId }: GuestBrowserPathInput): string {
  const machineSegment = encodeURIComponent(machineId);

  return `/machines/${machineSegment}/browser`;
}

type GuestBrowserReceiptPathInput = GuestBrowserPathInput & { readonly requestId: BrowserRequestId };

/** Reads one original-machine receipt without dispatching or reconstructing its browser action. */
export function guestBrowserReceiptPath({ machineId, requestId }: GuestBrowserReceiptPathInput): string {
  const browserPath = guestBrowserPath({ machineId });
  const requestSegment = encodeURIComponent(requestId);

  return `${browserPath}/${GuestSegment.Requests}/${requestSegment}`;
}

type GuestBrowserArtifactPathInput = {
  readonly machineId: RecordId;
  readonly artifactId: EvidenceArtifactId;
  readonly offset: number;
};

/** Addresses a bounded artifact chunk by identity instead of exposing arbitrary guest files. */
export function guestBrowserArtifactPath({ machineId, artifactId, offset }: GuestBrowserArtifactPathInput): string {
  const browserPath = guestBrowserPath({ machineId });
  const artifactSegment = encodeURIComponent(artifactId);

  return `${browserPath}/artifacts/${artifactSegment}?offset=${offset}`;
}
