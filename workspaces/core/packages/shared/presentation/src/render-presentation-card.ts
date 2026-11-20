import { toCard } from '@json-render/chat';
import type { CardLimits } from '@json-render/chat';
import { PRESENTATION_COMPONENTS } from './components.ts';
import type { StaticPresentationSpecification } from './elements.ts';
import { PRESENTATION_LIMITS } from './limits.ts';

const CARD_LIMITS: Readonly<CardLimits> = {
  tables: PRESENTATION_LIMITS.tables,
  charts: PRESENTATION_LIMITS.charts,
  fields: PRESENTATION_LIMITS.fields,
  tableRows: PRESENTATION_LIMITS.tableRows + 1,
  tableColumns: PRESENTATION_LIMITS.tableColumns,
  chartLabel: PRESENTATION_LIMITS.chartLabelChars,
  chartTitle: PRESENTATION_LIMITS.chartTitleChars,
  chartSeries: PRESENTATION_LIMITS.chartSeries,
  chartPoints: PRESENTATION_LIMITS.chartPoints,
};

type RenderPresentationCardInput = { readonly spec: StaticPresentationSpecification };

export function renderPresentationCard({ spec }: RenderPresentationCardInput): ReturnType<typeof toCard> {
  return toCard(spec, {
    components: PRESENTATION_COMPONENTS,
    limits: CARD_LIMITS,
    maxElements: PRESENTATION_LIMITS.elements,
  });
}
