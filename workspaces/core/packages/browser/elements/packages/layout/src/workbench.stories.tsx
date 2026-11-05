import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Conversation, Message, PromptInput } from '../../ai/src/index.ts';
import { Button, Heading, Muted, Row, Stack, Subheading } from '../../core/src/index.ts';
import { AppShell } from './app-shell.tsx';
import { PageToolbar } from './page-toolbar.tsx';
import { Navigation, NavigationLink } from './sidebar.tsx';
import { Workbench, WorkbenchFooter, WorkbenchScroll } from './workbench.tsx';

const meta = {
  title: 'Layout/Workbench',
  component: Workbench,
  subcomponents: { WorkbenchFooter, WorkbenchScroll },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Supported. Workbench fills the remaining viewport beneath PageToolbar. Its optional header is for content that needs a second heading. Place Conversation directly inside for its own scroll anchoring. WorkbenchScroll owns one gutter for other content, or uses flush when a collection owns row insets. It requires an accessible label and remains keyboard focusable; applications supply scrollRestorationId when their router restores the region. WorkbenchFooter separates a persistent composer from the scroll region. For a full-page detail that preserves an inactive conversation, use ViewStack with AppShell focus. The optional inspector remains available for smaller contextual details. At a workbench width of at most 860px, it fills the content area while the main column stays mounted. Applications own navigation, closing, focus restoration, and data.',
      },
    },
  },
} satisfies Meta<typeof Workbench>;

export default meta;
type Story = StoryObj;

function Example(): ReactNode {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  return (
    <AppShell
      sidebar={
        <Navigation>
          <NavigationLink href="#workspace">Workspace</NavigationLink>
        </Navigation>
      }
    >
      <PageToolbar title="Conversation" />
      <Workbench
        header={<Heading compact>Project assistant</Heading>}
        inspector={
          open ? (
            <Stack>
              <Row between>
                <Subheading>Execution details</Subheading>
                <Button onClick={() => setOpen(false)}>Close inspector</Button>
              </Row>
              <Muted>The application supplies recorded evidence here.</Muted>
            </Stack>
          ) : undefined
        }
      >
        <Conversation.Root>
          <Conversation.Viewport label="Example conversation">
            <Conversation.Content>
              <Conversation.Item messageId="request">
                <Message author="You" kind="user">
                  What changed in this release?
                </Message>
              </Conversation.Item>
              <Conversation.Item messageId="reply">
                <Message
                  author="Project assistant"
                  actions={<Button onClick={() => setOpen(true)}>Inspect run</Button>}
                >
                  The release adds a conversation view and a contextual inspector.
                </Message>
              </Conversation.Item>
            </Conversation.Content>
          </Conversation.Viewport>
          <Conversation.JumpToLatest />
        </Conversation.Root>
        <WorkbenchFooter>
          <PromptInput
            compact
            label="Message"
            value={text}
            onValueChange={setText}
            onSubmit={(event) => event.preventDefault()}
            description="Example only. This composer does not send a message."
          />
        </WorkbenchFooter>
      </Workbench>
    </AppShell>
  );
}

export const Recommended: Story = { render: () => <Example /> };
export const Narrow: Story = { ...Recommended, globals: { viewport: { value: 'narrow', isRotated: false } } };

export const EmbeddedInspector: Story = {
  render: () => (
    <div style={{ width: 720, maxWidth: '100%' }}>
      <PageToolbar navigation={false} title="Selected operation" />
      <Workbench
        header={<Subheading>Prepare release notes</Subheading>}
        inspector={
          <Stack>
            <Subheading>Execution details</Subheading>
            <Muted>The inspector uses the full available column at this width.</Muted>
          </Stack>
        }
      >
        <WorkbenchScroll label="Recorded output">
          <Muted>The main content remains mounted while its inspector is open.</Muted>
        </WorkbenchScroll>
      </Workbench>
    </div>
  ),
};
