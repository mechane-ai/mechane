import type { SourceCheckout } from '@mechane/sandbox-wire';
import type { SourceTaskInput } from '../types.ts';

/** Checkout steps reuse the same persisted source and immutable guest request. */
export type SourceCheckoutContext = SourceTaskInput & { readonly checkout: SourceCheckout };
