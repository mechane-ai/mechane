import { renderPresentationText } from './render-presentation-text.ts';
import { PresentationOutput, PresentationSpecification } from './schemas.ts';

type CreatePresentationOutputInput = { readonly spec: unknown };

/**
 * Validates an untrusted specification and derives its complete readable fallback. Throws when the tree or resulting
 * payload exceeds shared limits.
 */
export function createPresentationOutput({ spec }: CreatePresentationOutputInput): PresentationOutput {
  const parsed = PresentationSpecification.parse(spec);
  const fallback = renderPresentationText({ spec: parsed });

  return PresentationOutput.parse({ spec: parsed, fallback });
}
