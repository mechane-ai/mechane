import { z } from 'zod';
import { StaticPresentationSpecification } from './elements.ts';
import { PRESENTATION_LIMITS } from './limits.ts';
import { validatePresentation } from './validate-presentation.ts';

const PRESENTATION_INSTRUCTIONS = [
  'Supply a complete static spec with only root and elements. Every element has type, props, and children. Leaves use an empty children array.',
  'The root must be a Card. Use Section to group its descendants; do not nest Cards.',
  'Every element must be reachable from the root through exactly one parent. Do not use state, visible, repeat, expressions, event handlers, or action buttons.',
  'Use Fields for a few key values, Table for rows, Chart for trends or shares, and Actions with HTTPS LinkButton for navigation.',
  'Field elements belong inside Fields. LinkButton elements belong inside Actions.',
  'Text content supports Markdown. Format numbers as strings in fields and tables. Chart values remain numbers; every series matches the categories.',
  'Keep the presentation concise enough for one chat message. Prefer a text answer when a visual does not improve understanding.',
].join('\n');

/**
 * Accepts one static tree whose nodes, links, dimensions, and size satisfy both rendering targets. Unknown fields and
 * unreachable or repeated nodes are rejected.
 */
export const PresentationSpecification = StaticPresentationSpecification.superRefine((spec, context) => {
  validatePresentation({ spec, context });
})
  .brand<'PresentationSpecification'>()
  .describe(PRESENTATION_INSTRUCTIONS);

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
