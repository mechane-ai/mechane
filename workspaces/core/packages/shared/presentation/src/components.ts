import { standardComponentDefinitions } from '@json-render/chat';
import { z } from 'zod';
import { PRESENTATION_LIMITS } from './limits.ts';

const DisplayText = z.string().max(PRESENTATION_LIMITS.textChars);
const Label = z.string().min(1).max(PRESENTATION_LIMITS.labelChars);
const ChartLabel = z.string().min(1).max(PRESENTATION_LIMITS.chartLabelChars);
const HttpsUrl = z.url().max(PRESENTATION_LIMITS.urlChars).refine(isHttpsLink, 'Use an HTTPS URL without credentials.');
const StandardPieChart = standardComponentDefinitions.Chart.props.shape.chart.options[0];
const StandardSeriesChart = standardComponentDefinitions.Chart.props.shape.chart.options[1];

const PieChart = StandardPieChart.extend({
  segments: z
    .array(z.strictObject({ label: ChartLabel, value: z.number().positive() }))
    .min(1)
    .max(PRESENTATION_LIMITS.chartSeries),
}).strict();

const SeriesChart = StandardSeriesChart.extend({
  categories: z.array(ChartLabel).min(1).max(PRESENTATION_LIMITS.chartPoints),
  series: z
    .array(
      z.strictObject({ name: ChartLabel, values: z.array(z.number()).min(1).max(PRESENTATION_LIMITS.chartPoints) }),
    )
    .min(1)
    .max(PRESENTATION_LIMITS.chartSeries),
  xLabel: ChartLabel.nullish(),
  yLabel: ChartLabel.nullish(),
}).strict();

/**
 * Constrains native json-render Chat components to text, tables, charts, and HTTPS navigation. It excludes executable
 * actions and remote images.
 */
export const PRESENTATION_COMPONENTS = {
  Card: {
    ...standardComponentDefinitions.Card,
    props: standardComponentDefinitions.Card.props
      .omit({ imageUrl: true })
      .extend({
        title: z.string().min(1).max(PRESENTATION_LIMITS.titleChars).nullish(),
        subtitle: DisplayText.nullish(),
      })
      .strict(),
  },
  Section: { ...standardComponentDefinitions.Section, props: standardComponentDefinitions.Section.props.strict() },
  Text: {
    ...standardComponentDefinitions.Text,
    props: standardComponentDefinitions.Text.props.extend({ content: DisplayText.min(1) }).strict(),
  },
  Fields: { ...standardComponentDefinitions.Fields, props: standardComponentDefinitions.Fields.props.strict() },
  Field: {
    ...standardComponentDefinitions.Field,
    props: standardComponentDefinitions.Field.props
      .extend({ label: Label, value: DisplayText.max(PRESENTATION_LIMITS.fieldChars) })
      .strict(),
  },
  Table: {
    ...standardComponentDefinitions.Table,
    props: standardComponentDefinitions.Table.props
      .extend({
        headers: z.array(Label).min(1).max(PRESENTATION_LIMITS.tableColumns),
        rows: z
          .array(z.array(DisplayText).min(1).max(PRESENTATION_LIMITS.tableColumns))
          .min(1)
          .max(PRESENTATION_LIMITS.tableRows),
        align: z
          .array(z.enum(['left', 'center', 'right']))
          .min(1)
          .max(PRESENTATION_LIMITS.tableColumns)
          .nullish(),
        caption: DisplayText.nullish(),
      })
      .strict(),
  },
  Chart: {
    ...standardComponentDefinitions.Chart,
    props: standardComponentDefinitions.Chart.props
      .extend({
        title: z.string().min(1).max(PRESENTATION_LIMITS.chartTitleChars),
        chart: z.discriminatedUnion('type', [PieChart, SeriesChart]),
      })
      .strict(),
  },
  Divider: { ...standardComponentDefinitions.Divider, props: standardComponentDefinitions.Divider.props.strict() },
  Actions: { ...standardComponentDefinitions.Actions, props: standardComponentDefinitions.Actions.props.strict() },
  LinkButton: {
    ...standardComponentDefinitions.LinkButton,
    props: standardComponentDefinitions.LinkButton.props.extend({ label: Label, url: HttpsUrl }).strict(),
  },
} as const;

function isHttpsLink(value: string): boolean {
  if (!URL.canParse(value)) {
    return false;
  }

  const url = new URL(value);

  if (url.protocol !== 'https:' || url.username !== '') {
    return false;
  }

  return url.password === '';
}
