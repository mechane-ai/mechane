import { Button, Heading, Muted, Panel, Stack } from '@mechane/ui';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Archive, FileText, Folder, Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { AppShell } from './app-shell.tsx';
import { DetailPage } from './detail-page.tsx';
import { PageToolbar, ToolbarAction } from './page-toolbar.tsx';
import { Navigation, NavigationItem, NavigationLink, SidebarFooter, SidebarLabel } from './sidebar.tsx';

const meta = {
  title: 'Layout/AppShell',
  component: AppShell,
  subcomponents: {
    PageToolbar,
    ToolbarAction,
    DetailPage,
    Navigation,
    NavigationItem,
    NavigationLink,
    SidebarLabel,
    SidebarFooter,
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Supported. AppShell owns the expanded sidebar, collapsed rail, and phone drawer. Navigation groups NavigationLink destinations or NavigationItem actions. SidebarLabel hides supporting text on the collapsed rail; SidebarFooter groups a persistent identity. PageToolbar owns its continuous outer border, while ToolbarAction supplies resource actions. DetailPage centers a form or detail view; tables stay flush in the main area. The application supplies routing, selection, branding, account controls, and commands. Use the toolbar toggle to inspect collapsed labels, then use the phone example to inspect focus and drawer dismissal.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function CollectionShell(): ReactNode {
  const [view, setView] = useState('Release notes');

  return (
    <AppShell
      sidebarHeader={<SidebarLabel>Example collection</SidebarLabel>}
      sidebar={
        <Navigation label="Collection">
          <NavigationItem
            icon={<FileText size={16} />}
            selected={view === 'Release notes'}
            onClick={() => setView('Release notes')}
          >
            Release notes
          </NavigationItem>
          <NavigationItem icon={<Archive size={16} />} selected={view === 'Archive'} onClick={() => setView('Archive')}>
            Archive
          </NavigationItem>
          <NavigationLink icon={<Folder size={16} />} href="#shared-collection">
            Shared collection with a long descriptive name
          </NavigationLink>
        </Navigation>
      }
      footer={
        <SidebarFooter>
          <Folder size={16} aria-hidden />
          <SidebarLabel>Example workspace</SidebarLabel>
        </SidebarFooter>
      }
    >
      <PageToolbar
        title={view}
        actions={
          <>
            <ToolbarAction aria-label="Refresh items">
              <RefreshCw size={16} aria-hidden />
            </ToolbarAction>
            <ToolbarAction icon={<Plus size={16} aria-hidden />}>Create item</ToolbarAction>
          </>
        }
      />
      <DetailPage>
        <Stack>
          <Heading>{view}</Heading>
          <Muted>A shared frame keeps navigation, toolbar borders, and content spacing consistent.</Muted>
          <Panel>
            <Stack compact>
              <Muted>
                This content remains readable when the sidebar collapses or the navigation moves into a drawer.
              </Muted>
              <div>
                <Button>View details</Button>
              </div>
            </Stack>
          </Panel>
        </Stack>
      </DetailPage>
    </AppShell>
  );
}

export const Recommended: Story = { render: () => <CollectionShell /> };
export const PhoneNavigation: Story = { ...Recommended, globals: { viewport: { value: 'narrow', isRotated: false } } };

export const ToolbarWithoutNavigation: Story = {
  render: () => (
    <PageToolbar
      navigation={false}
      title="An item with a long descriptive name and a bounded toolbar"
      actions={<ToolbarAction icon={<Plus size={16} aria-hidden />}>Create item</ToolbarAction>}
    />
  ),
};
