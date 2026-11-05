import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { PromptInput } from '../../ai/src/index.ts';
import { Button, Prose, Stack } from '../../core/src/index.ts';
import { AppShell } from './app-shell.tsx';
import { PageToolbar, ToolbarAction } from './page-toolbar.tsx';
import { Navigation, NavigationItem, NavigationSection } from './sidebar.tsx';
import { ViewStack } from './view-stack.tsx';
import { Workbench, WorkbenchFooter, WorkbenchScroll } from './workbench.tsx';

const meta = {
  title: 'Layout/ViewStack',
  component: ViewStack.Root,
  subcomponents: { ViewStackPanel: ViewStack.Panel },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Supported. ViewStack keeps inactive panels mounted, measurable, hidden, and inert. Applications decide which panels have been visited and retain their data and draft lifetimes. AppShell focus temporarily hides navigation without changing its expanded preference. Open the detail view, then return to inspect the retained draft. WorkbenchScroll owns one gutter, or uses flush when a collection owns row insets. Give its scrollRestorationId from the application when a router restores this region.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function Example(): ReactNode {
  const [isFocused, setFocused] = useState(false);
  const [draft, setDraft] = useState('Keep this draft while inspecting the result.');

  return (
    <AppShell
      shouldFocus={isFocused}
      sidebar={
        <Navigation>
          <NavigationSection label="Overview">
            <NavigationItem isSelected>Conversations</NavigationItem>
          </NavigationSection>
        </Navigation>
      }
    >
      <ViewStack.Root>
        <ViewStack.Panel isActive={!isFocused}>
          <PageToolbar title="Project assistant" />
          <Workbench>
            <WorkbenchScroll label="Conversation" scrollRestorationId="example-conversation">
              <Stack>
                <Prose>The recorded result is ready to inspect.</Prose>
                <div>
                  <Button onClick={() => setFocused(true)}>Open run</Button>
                </div>
              </Stack>
            </WorkbenchScroll>
            <WorkbenchFooter>
              <PromptInput
                label="Message"
                isCompact
                value={draft}
                onValueChange={setDraft}
                onSubmit={(event) => event.preventDefault()}
              />
            </WorkbenchFooter>
          </Workbench>
        </ViewStack.Panel>
        {isFocused && (
          <>
            <PageToolbar
              title="Run details"
              showNavigation={false}
              leading={<ToolbarAction onClick={() => setFocused(false)}>Back</ToolbarAction>}
            />
            <Workbench>
              <WorkbenchScroll label="Run details">
                <Prose>This detail uses the full application width. The conversation remains mounted.</Prose>
              </WorkbenchScroll>
            </Workbench>
          </>
        )}
      </ViewStack.Root>
    </AppShell>
  );
}

export const Recommended: Story = { render: () => <Example /> };
export const Narrow: Story = { ...Recommended, globals: { viewport: { value: 'narrow', isRotated: false } } };
