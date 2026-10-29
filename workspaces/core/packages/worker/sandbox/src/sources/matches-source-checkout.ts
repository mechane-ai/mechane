import type { SourceFence } from '@mechane/sandbox-store';
import type { SourceCheckout } from '@mechane/sandbox-wire';

type MatchesSourceCheckoutInput = { readonly fence: SourceFence; readonly checkout: SourceCheckout };

/** A source retry must retain the complete checkout intent before any credential can reach its guest. */
export function matchesSourceCheckout({ fence, checkout }: MatchesSourceCheckoutInput): boolean {
  return (
    fence.generation === checkout.generation &&
    fence.commit === checkout.commit &&
    fence.repositoryUrl === checkout.repositoryUrl
  );
}
