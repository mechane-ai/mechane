/** Owners configure repository authority separately from checkout and publication requests. */
export const SourceAction = { Configure: 'configure', Checkout: 'checkout', Publish: 'publish', Show: 'show' } as const;
export type SourceAction = (typeof SourceAction)[keyof typeof SourceAction];
/** Source readiness follows the credential fence and durable checkout checkpoint. */
export const SourceStatus = { Preparing: 'preparing', Fenced: 'fenced', Ready: 'ready', Failed: 'failed' } as const;
export type SourceStatus = (typeof SourceStatus)[keyof typeof SourceStatus];

/** Uncertain publication requires reconciliation of the recorded intent before another external write. */
export const SourcePublicationStatus = {
  Capturing: 'capturing',
  Committing: 'committing',
  Publishing: 'publishing',
  Published: 'published',
  Uncertain: 'uncertain',
  Rejected: 'rejected',
} as const;

export type SourcePublicationStatus = (typeof SourcePublicationStatus)[keyof typeof SourcePublicationStatus];
