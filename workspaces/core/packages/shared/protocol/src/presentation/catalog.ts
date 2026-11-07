import { schema } from '@json-render/chat';
import { defineCatalog, defineSchema } from '@json-render/core';
import { PRESENTATION_COMPONENTS } from './components.ts';

const PresentationSchema = defineSchema(() => schema.definition, {
  defaultRules: [
    'The root must be a Card. Use Section to group its descendants; do not nest Cards.',
    'Return a complete static spec with only root and elements. Every element has type, props, and children. Leaves use an empty children array.',
    'Every element must be reachable from the root through exactly one parent. Do not use state, visible, repeat, expressions, event handlers, or action buttons.',
    'Use Fields for a few key values, Table for rows, Chart for trends or shares, and Actions with HTTPS LinkButton for navigation.',
    'Field elements belong inside Fields. LinkButton elements belong inside Actions.',
    'Text content supports Markdown. Format numbers as strings in fields and tables. Chart values remain numbers; every series matches the categories.',
    'Keep the presentation concise enough for one chat message. Prefer a text answer when a visual does not improve understanding.',
  ],
});

/**
 * Defines the static visual vocabulary shared by model tools, Slack cards, and Console rendering. Catalog output still
 * requires PresentationSpecification validation.
 */
export const PresentationCatalog = defineCatalog(PresentationSchema, { components: PRESENTATION_COMPONENTS });
