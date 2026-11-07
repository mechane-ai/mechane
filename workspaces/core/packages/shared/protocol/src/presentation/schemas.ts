import { z } from 'zod';
import { StaticPresentationSpecification } from './elements.ts';
import { PRESENTATION_LIMITS } from './limits.ts';
import { validatePresentation } from './validate-presentation.ts';

/**
 * Accepts one static tree whose nodes, links, dimensions, and size satisfy both rendering targets. Unknown fields and
 * unreachable or repeated nodes are rejected.
 */
export const PresentationSpecification = StaticPresentationSpecification.superRefine((spec, context) => {
  validatePresentation({ spec, context });
}).brand<'PresentationSpecification'>();

export type PresentationSpecification = z.infer<typeof PresentationSpecification>;

/**
 * Pairs a validated visual specification with bounded fallback text for clients without the catalog. Construct it with
 * createPresentationOutput to keep both representations aligned.
 */
export const PresentationOutput = z.strictObject({
  spec: PresentationSpecification,
  fallback: z.string().min(1).max(PRESENTATION_LIMITS.fallbackChars),
});

export type PresentationOutput = z.infer<typeof PresentationOutput>;
