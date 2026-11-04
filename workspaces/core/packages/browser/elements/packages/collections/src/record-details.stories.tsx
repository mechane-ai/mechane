import type { Meta, StoryObj } from '@storybook/react-vite';
import { CopyValue, Muted, Panel, Prose, Stack, Subheading } from '../../core/src/index.ts';
import { Details, Inspector } from './inspector.tsx';
import { Metric, MetricGrid } from './metrics.tsx';

const meta = {
  title: 'Data display/Record details',
  component: Inspector,
  subcomponents: { Details, MetricGrid, Metric, CopyValue },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Inspector groups a selected detail with its master content and requires a contextual accessible label. Details is a key/value list. MetricGrid groups Metric values, and CopyValue copies an exact value while allowing a shorter visible label. The application supplies selection, labels, bounded content, and formatted values. Keep unknown values visibly unknown. Use Table for comparable rows and Prose for plain text; these components do not parse resource records or choose units. CopyValue announces success and exposes the original value if clipboard access fails.',
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
      master={
        <Panel>
          <Stack compact>
            <Subheading>Prepare release notes</Subheading>
            <Muted>The selected operation’s summary remains available.</Muted>
          </Stack>
        </Panel>
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
          label: 'Reference',
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
