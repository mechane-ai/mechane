import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Heading, Muted } from '../../core/src/index.ts';
import { FocusPage } from './focus-page.tsx';

const meta = {
  title: 'Layout/FocusPage',
  component: FocusPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Supported. A standalone page for sign-in, workspace selection, or an initial access error. It supplies a main landmark and a centered, narrow column without application navigation. The application supplies its own wordmark, heading, and action.',
      },
    },
  },
} satisfies Meta<typeof FocusPage>;

export default meta;
type Story = StoryObj<typeof FocusPage>;

export const Recommended: Story = {
  render: () => (
    <FocusPage>
      <strong>Workspace</strong>
      <Heading>Welcome back.</Heading>
      <Muted>Sign in to pick up where you left off.</Muted>
      <Button variant="solid">Continue</Button>
    </FocusPage>
  ),
};

export const Narrow: Story = { ...Recommended, globals: { viewport: { value: 'narrow', isRotated: false } } };
