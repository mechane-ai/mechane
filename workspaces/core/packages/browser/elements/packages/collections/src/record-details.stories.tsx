import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { useRef, useState } from 'react';
import { Sparkline } from '../../charts/src/cartesian/index.ts';
import { Button, CopyValue, Muted, Prose, Stack, Subheading } from '../../core/src/index.ts';
import { spacing } from '../../foundations/src/tokens.stylex.ts';
import { Details, Inspector } from './inspector.tsx';
import { Metric, MetricGrid } from './metrics.tsx';

const styles = stylex.create({ master: { padding: spacing.xl }, narrow: { maxWidth: 280 } });

const meta = {
  title: 'Data display/Record details',
  component: Inspector,
  subcomponents: { Details, MetricGrid, Metric, CopyValue },
  parameters: {
    docs: {
      description: {
        component:
          'Inspector places a supplied collection beside its sticky selected detail in a wide container and stacks them in a narrow one. The surrounding page owns scrolling; Inspector adds no nested scroll region or outer card. Supply the required masterLabel for the collection and label for its selected detail. Existing consumers must add masterLabel when upgrading. A changed revealKey explicitly reveals and focuses the detail on narrow containers; omit it for default selection and passive keyboard movement. Pass returnFocusRef to restore the selected control from the compact Back button. Selection and reveal intent belong to the application. Details is a key/value list. MetricGrid groups Metric values; layout="columns" follows the available container width. CopyValue copies an exact value while allowing a shorter visible label. The application supplies selection, labels, bounded content, and formatted values. Keep unknown values visibly unknown. Use DataTable for comparable rows and Prose for plain text; these components do not parse resource records or choose units. CopyValue announces success and exposes the original value if clipboard access fails.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Recommended: Story = {
  render: () => (
    <Inspector
      label="Selected example operation"
      masterLabel="Operations"
      master={
        <div {...stylex.props(styles.master)}>
          <Stack isCompact>
            <Subheading>Prepare release notes</Subheading>
            <Muted>The selected operation’s summary remains available.</Muted>
          </Stack>
        </div>
      }
      detail={
        <Stack>
          <MetricGrid>
            <Metric label="elapsed" value="350 ms" />
            <Metric label="items" value="0" />
            <Metric label="reported total" value="Unknown" />
          </MetricGrid>
          <Details
            items={[
              { label: 'State', value: 'Completed' },
              { label: 'Reference', value: <CopyValue label="reference" value="example-reference-2026-11-03" /> },
              {
                label: 'Recorded at',
                value: (
                  <CopyValue label="exact timestamp" value="2026-11-03T12:00:00.000Z">
                    12:00 UTC
                  </CopyValue>
                ),
              },
            ]}
          />
        </Stack>
      }
    />
  ),
};

export const LongValues: Story = {
  render: () => (
    <Details
      items={[
        {
          label: 'Source reference with a long descriptive label',
          value: (
            <CopyValue
              label="reference"
              value="example-reference-with-a-long-unbroken-suffix-0123456789abcdef0123456789abcdef"
            />
          ),
        },
        {
          label: 'Recorded output',
          value: <Prose>{'The recorded result is plain text.\nA second line remains part of the same value.'}</Prose>,
        },
        { label: 'Reported usage', value: 'Not recorded' },
      ]}
    />
  ),
};

export const MetricColumns: Story = {
  render: () => (
    <MetricGrid layout="columns">
      <Metric label="completed" value="472" />
      <Metric label="failed" value="8" />
      <Metric label="median duration" value="350 ms" />
      <Metric label="reported total" value="Unknown" />
    </MetricGrid>
  ),
};

export const ReportMetrics: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Metric uses inline values for record details, statistic values for peer report measures, and headline for the primary chart measure. Supply formatted strings and concise qualifications. The optional trend slot accepts a prepared passive graphic or its placeholder. Keep business rules and reporting coverage with the application. Pending values reserve the same value and detail geometry.',
      },
    },
  },
  render: () => (
    <Stack>
      <MetricGrid>
        <Metric
          label="Reported spend · USD"
          value="$12,340.50"
          detail="28 of 28 days reported · Provisional"
          variant="headline"
        />
        <Metric label="Change from October" value="−$250.00" detail="−2%" variant="statistic" />
      </MetricGrid>
      <MetricGrid layout="columns">
        <Metric
          label="Completed"
          value="472"
          variant="statistic"
          trend={
            <Sparkline
              title="Daily completed operations"
              summary="Three days of recorded operation counts"
              unit="operations"
              timestampUnit="seconds"
              valueDomain={[0, 200]}
              series={{
                id: 'completed',
                label: 'Completed',
                points: [
                  { timestamp: 0, value: 120 },
                  { timestamp: 86_400, value: 200 },
                  { timestamp: 172_800, value: 152 },
                ],
              }}
            />
          }
        />
        <Metric label="Failed" value="8" variant="statistic" />
        <Metric label="Duration" value="Unknown" detail="No timing recorded" variant="statistic" />
      </MetricGrid>
    </Stack>
  ),
};

export const PendingMetrics: Story = {
  render: () => (
    <Stack>
      <MetricGrid>
        <Metric label="Reported spend · USD" variant="headline" isLoading hasDetail />
      </MetricGrid>
      <MetricGrid layout="columns">
        <Metric label="Completed" variant="statistic" isLoading />
        <Metric label="Failed" variant="statistic" isLoading />
        <Metric label="Duration" variant="statistic" isLoading hasDetail />
      </MetricGrid>
    </Stack>
  ),
};

export const NarrowHeadline: Story = {
  render: () => (
    <div {...stylex.props(styles.narrow)}>
      <MetricGrid>
        <Metric
          label="Recorded processing cost for the selected environment · USD"
          value="−$1,234,567.89"
          detail="19 of 28 days reported · Provisional"
          variant="headline"
        />
      </MetricGrid>
    </div>
  ),
};

export const NarrowMetrics: Story = {
  render: () => (
    <div {...stylex.props(styles.narrow)}>
      <MetricGrid layout="columns">
        <Metric label="completed evaluations with recorded output" value="472" />
        <Metric label="median duration across successful evaluations" value="350 ms" />
        <Metric label="reportedtotalwithoutseparators" value="Unknown" />
      </MetricGrid>
    </div>
  ),
};

export const NarrowDetails: Story = { ...LongValues, globals: { viewport: { value: 'narrow', isRotated: false } } };

function InspectionExample() {
  const [selected, setSelected] = useState('verify');
  const [reveal, setReveal] = useState<number>();
  const selectedRow = useRef<HTMLButtonElement>(null);

  const operations = [
    { id: 'verify', label: 'Verify restored files', result: 'Recorded source and manifest agree.' },
    { id: 'compile', label: 'Compile browser packages', result: 'Build completed in 8.4s.' },
    { id: 'review', label: 'Review release notes', result: 'No committed result is available yet.' },
  ];

  const current = operations.find((operation) => operation.id === selected);

  return (
    <Inspector
      label="Selected operation"
      masterLabel="Operations"
      revealKey={reveal === undefined ? undefined : String(reveal)}
      returnFocusRef={selectedRow}
      master={
        <Stack isCompact>
          {operations.map((operation) => (
            <Button
              key={operation.id}
              ref={operation.id === selected ? selectedRow : undefined}
              aria-pressed={operation.id === selected}
              onClick={() => {
                setSelected(operation.id);
                setReveal((prior) => (prior ?? 0) + 1);
              }}
            >
              {operation.label}
            </Button>
          ))}
        </Stack>
      }
      detail={
        <Stack isCompact>
          <Subheading>{current?.label}</Subheading>
          <Prose>{current?.result}</Prose>
        </Stack>
      }
    />
  );
}

export const Selection: Story = { render: () => <InspectionExample /> };
export const NarrowSelection: Story = { ...Selection, globals: { viewport: { value: 'narrow', isRotated: false } } };
