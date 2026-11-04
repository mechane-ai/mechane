import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Muted, Row, Stack, Text, TextLink } from '../../core/src/index.ts';
import { Popover } from './popover.tsx';
import { Preview } from './preview.tsx';

const meta = {
  title: 'Overlays/Popover',
  component: Popover.Root,
  subcomponents: {
    Trigger: Popover.Trigger,
    Portal: Popover.Portal,
    Positioner: Popover.Positioner,
    Popup: Popover.Popup,
    Title: Popover.Title,
    Description: Popover.Description,
    Close: Popover.Close,
    Preview: Preview.Root,
    PreviewTrigger: Preview.Trigger,
    PreviewPortal: Preview.Portal,
    PreviewPositioner: Preview.Positioner,
    PreviewPopup: Preview.Popup,
  },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Popover provides an anchored, explicitly opened panel for details and controls. Use Dialog for a modal decision and Tooltip for a short noninteractive label. Preview supplies supplementary link information on hover or focus; keep essential information in the destination and use Popover when touch users need to inspect it before acting. Base UI owns positioning, dismissal and focus. Content is supplied ready; opening never fetches data inside UI.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const DetailPanel: Story = {
  render: () => (
    <Popover.Root>
      <Popover.Trigger render={<Button />}>View context</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="start">
          <Popover.Popup>
            <Popover.Title>Context capacity</Popover.Title>
            <Popover.Description>
              This example includes only supplied records. The application decides what to include.
            </Popover.Description>
            <Text>12,400 of 128,000 tokens</Text>
            <Popover.Close render={<Button />}>Done</Popover.Close>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  ),
};

export const LinkPreview: Story = {
  render: () => (
    <Stack>
      <Row>
        <Text>Related record:</Text>
        <Preview.Root>
          <Preview.Trigger href="#record" render={<TextLink />}>
            Sample evaluation
          </Preview.Trigger>
          <Preview.Portal>
            <Preview.Positioner>
              <Preview.Popup>
                <Text>Sample evaluation</Text>
                <Muted>24 recorded comparisons. This synthetic record has no external data source.</Muted>
              </Preview.Popup>
            </Preview.Positioner>
          </Preview.Portal>
        </Preview.Root>
      </Row>
      <Muted>The link remains usable without the preview.</Muted>
    </Stack>
  ),
};
