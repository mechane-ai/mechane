import { Duration } from 'effect';

/** Guest steps separate credential exposure from activation and file capture. */
export const SourceStep = {
  Prepare: 'prepare',
  PrepareCapture: 'prepare-capture',
  Clone: 'clone',
  Activate: 'activate',
  Release: 'release',
  Changes: 'changes',
} as const;

export type SourceStep = (typeof SourceStep)[keyof typeof SourceStep];

/** Only a terminal phase admits normal sandbox execution again. */
export const SourceFencePhase = {
  Preparing: 'preparing',
  Prepared: 'prepared',
  Exposed: 'exposed',
  Revoked: 'revoked',
  Finalizing: 'finalizing',
  Ready: 'ready',
  Failed: 'failed',
} as const;

export type SourceFencePhase = (typeof SourceFencePhase)[keyof typeof SourceFencePhase];
/** Clock and propagation slack extends a fence when token revocation cannot be confirmed. */
export const SOURCE_EXPIRY_MARGIN = Duration.minutes(1);
/** Trusted Git must finish within this bounded credential-exposure request. */
export const SOURCE_CHECKOUT_TIMEOUT = Duration.minutes(10);
/** Abandoned preparation can expire because no token has reached the guest. */
export const SOURCE_PREPARATION_TIMEOUT = Duration.minutes(5);
/** Credential-free finalization uses the normal checkpoint execution boundary. */
export const SOURCE_FINALIZE_TIMEOUT = Duration.minutes(2);
