import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { Button, TextLink } from './actions.tsx';
import { Drawer } from './drawer.tsx';
import { Stack } from './surfaces.tsx';
import { spacing } from './tokens.stylex.ts';

const styles = stylex.create({
  content: { width: 240, maxWidth: '100%', boxSizing: 'border-box', padding: spacing.xl },
});

const meta = {
  title: 'Overlays/Drawer',
  component: Drawer.Root,
  subcomponents: {
    Trigger: Drawer.Trigger,
    Portal: Drawer.Portal,
    Backdrop: Drawer.Backdrop,
    Viewport: Drawer.Viewport,
    Popup: Drawer.Popup,
    Title: Drawer.Title,
    Description: Drawer.Description,
    Close: Drawer.Close,
  },
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Drawer.Root opens a left-edge region through Trigger. Portal contains Backdrop and Viewport, which positions Popup; Title and Description name it, and Close dismisses it. Use Drawer.createHandle to connect an external Trigger to Root. Keep unrelated screen content outside the modal root. AppShell already composes this family for phone navigation. Use that shell for application navigation and Dialog for a centered decision. The application supplies content, the closing action, and any width needed by that content. Keep Title visually hidden only when the visible context already names the region.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Recommended: Story = {
  render: () => (
    <Drawer.Root>
      <Drawer.Trigger render={<Button />}>Open collection navigation</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop />
        <Drawer.Viewport>
          <Drawer.Popup>
            <div {...stylex.props(styles.content)}>
              <Stack>
                <Drawer.Title>Collection navigation</Drawer.Title>
                <Drawer.Description>Choose an area to continue.</Drawer.Description>
                <TextLink href="#active-items">Active items</TextLink>
                <TextLink href="#archive">Archive</TextLink>
                <Drawer.Close render={<Button />}>Close navigation</Drawer.Close>
              </Stack>
            </div>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  ),
};
