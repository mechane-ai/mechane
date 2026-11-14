import type { Meta, StoryObj } from '@storybook/react-vite';
import { Activity, ChartNoAxesColumn, Server } from 'lucide-react';
import { Row, Stack } from '../../core/src/index.ts';
import { ChartSeriesMarker } from './chart-series-marker.tsx';

const meta = {
  title: 'Charts/Series marker',
  component: ChartSeriesMarker,
  parameters: {
    docs: {
      description: {
        component:
          'ChartSeriesMarker keeps a supplied chart tone and decorative artwork aligned beside a series label. Omit children for the standard legend swatch; supply a 16px icon for a table identity. The adjacent text names the series. Keep the same tone and stable series ID in chart marks, legends and related rows. The marker owns its nonshrinking geometry and has no interaction or selection state.',
      },
    },
  },
} satisfies Meta<typeof ChartSeriesMarker>;

export default meta;
type Story = StoryObj;

export const Labels: Story = {
  render: () => (
    <Stack>
      <Row>
        <ChartSeriesMarker tone="series1" /> Requests
      </Row>
      <Row>
        <ChartSeriesMarker tone="series2">
          <ChartNoAxesColumn size={16} />
        </ChartSeriesMarker>{' '}
        Metrics
      </Row>
      <Row>
        <ChartSeriesMarker tone="series3">
          <Activity size={16} />
        </ChartSeriesMarker>{' '}
        Trace activity
      </Row>
      <Row>
        <ChartSeriesMarker tone="series4">
          <Server size={16} />
        </ChartSeriesMarker>{' '}
        Infrastructure
      </Row>
      <Row>
        <ChartSeriesMarker tone="neutral" /> Other reported services
      </Row>
    </Stack>
  ),
};
