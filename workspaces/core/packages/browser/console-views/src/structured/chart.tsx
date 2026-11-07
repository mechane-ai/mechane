import type { ComponentFn } from '@json-render/react';
import { BarChart, BreakdownBar } from '@mechane-ai/elements/charts/cartesian';
import type { PresentationCatalog } from '@mechane/protocol/presentation';
import { PresentationTable } from './table.tsx';

const numberFormatter = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 8 });

export const PresentationChart: ComponentFn<typeof PresentationCatalog, 'Chart'> = ({ props }) => {
  const { title, chart } = props;

  if (chart.type === 'pie') {
    return (
      <BreakdownBar
        title={title}
        items={chart.segments.map((segment, index) => ({
          id: String(index),
          label: segment.label,
          value: segment.value,
        }))}
        total={chart.segments.reduce((total, segment) => total + segment.value, 0)}
        formatValue={formatNumber}
      />
    );
  }

  if (chart.type === 'bar') {
    const values = chart.series.flatMap((series) => series.values);
    const lower = Math.min(0, ...values);
    const upper = Math.max(0, ...values);
    const description = [chart.xLabel, chart.yLabel].filter(Boolean).join(' · ');

    return (
      <BarChart
        title={title}
        description={description.length > 0 ? description : undefined}
        categories={chart.categories.map((label, index) => ({ id: String(index), label }))}
        series={chart.series.map((series, index) => ({ id: String(index), label: series.name, values: series.values }))}
        domain={[lower, upper === lower ? lower + 1 : upper]}
        formatValue={formatNumber}
      />
    );
  }

  return (
    <PresentationTable
      caption={title}
      headers={[chart.xLabel ?? 'Category', ...chart.series.map((series) => series.name)]}
      rows={chart.categories.map((category, index) => [
        category,
        ...chart.series.map((series) => {
          const value = series.values[index];

          return value === undefined ? 'Unavailable' : formatNumber(value);
        }),
      ])}
    />
  );
};

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}
