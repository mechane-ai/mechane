import type { Meta, StoryObj } from '@storybook/react-vite';
import { Panel, Stack, Subheading, Text } from '../../core/src/index.ts';
import { Resizable } from './resizable.tsx';

const meta = {
  title: 'Layout/Resizable workspace',
  component: Resizable.Root,
  parameters: {
    docs: {
      description: {
        component:
          'Resizable Panels owns pointer and keyboard resizing. Supply stable pane IDs and initial percentages; persist size-change intent in the application. The library does not write local storage. Tab to the separator and use arrow keys.',
      },
    },
  },
} satisfies Meta<typeof Resizable.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inspector: Story = {
  render: () => (
    <div style={{ height: 320 }}>
      <Resizable.Root initialSizes={{ source: 65, inspector: 35 }}>
        <Resizable.Pane id="source" minimumSizePercent={30}>
          <Panel>
            <Stack>
              <Subheading>Source</Subheading>
              <Text>Prepared content remains mounted while resizing.</Text>
            </Stack>
          </Panel>
        </Resizable.Pane>
        <Resizable.Handle aria-label="Resize source and inspector" />
        <Resizable.Pane id="inspector" minimumSizePercent={20}>
          <Panel>
            <Stack>
              <Subheading>Inspector</Subheading>
              <Text>Keyboard and pointer gestures share one layout owner.</Text>
            </Stack>
          </Panel>
        </Resizable.Pane>
      </Resizable.Root>
    </div>
  ),
};
