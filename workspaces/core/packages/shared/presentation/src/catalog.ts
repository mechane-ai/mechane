import { schema } from '@json-render/chat';
import { defineCatalog } from '@json-render/core';
import { PRESENTATION_COMPONENTS } from './components.ts';

/**
 * Defines the static visual vocabulary shared by model tools and Slack card rendering. Catalog output still requires
 * PresentationSpecification validation.
 *
 * @public
 */
export const PresentationCatalog = defineCatalog(schema, { components: PRESENTATION_COMPONENTS });
