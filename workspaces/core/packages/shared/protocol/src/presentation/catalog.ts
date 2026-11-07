import { schema } from '@json-render/chat';
import { defineCatalog } from '@json-render/core';
import { PRESENTATION_COMPONENTS } from './components.ts';

/**
 * Defines the static visual vocabulary shared by model tools, Slack cards, and Console rendering. Catalog output still
 * requires PresentationSpecification validation.
 */
export const PresentationCatalog = defineCatalog(schema, { components: PRESENTATION_COMPONENTS });
