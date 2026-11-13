import type { Meta, StoryObj } from '@storybook/react-vite';
import { Archive, FileText, Folder, LogOut, Plus, RefreshCw, Settings } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Heading, Muted, Panel, Stack } from '../../core/src/index.ts';
import { AppShell } from './app-shell.tsx';
import { DetailPage } from './detail-page.tsx';
import { PageToolbar, ToolbarAction } from './page-toolbar.tsx';
import {
  Navigation,
  NavigationItem,
  NavigationLink,
  NavigationSection,
  SidebarFooter,
  SidebarLabel,
} from './sidebar.tsx';

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
    NavigationSection,
    SidebarLabel,
    SidebarFooter,
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Supported. AppShell owns the expanded sidebar, collapsed rail, and phone drawer. Its focus mode hides navigation while retaining the expansion preference. Navigation groups NavigationLink destinations or NavigationItem actions; NavigationSection labels related groups. SidebarLabel hides supporting text on the collapsed rail. SidebarFooter groups a persistent identity; use layout="navigation" for a persistent Navigation group whose content sets the footer height. Keep other commands in the scrolling navigation. PageToolbar owns its outer border, optional leading control, and view choices. ToolbarAction supplies resource actions; give compact actions an icon and a concise accessible label. DetailPage centers a form or detail view; tables stay flush in the main area. The application supplies routing, selection, branding, account controls, and commands. Inspect the last navigation item above the footer in a short viewport, then use the phone example to inspect focus and drawer dismissal.',
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
            isSelected={view === 'Release notes'}
            onClick={() => setView('Release notes')}
          >
            Release notes
          </NavigationItem>
          <NavigationItem
            icon={<Archive size={16} />}
            isSelected={view === 'Archive'}
            onClick={() => setView('Archive')}
          >
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
          <Panel>
            <Stack isCompact>
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
      showNavigation={false}
      title="An item with a long descriptive name and a bounded toolbar"
      actions={<ToolbarAction icon={<Plus size={16} aria-hidden />}>Create item</ToolbarAction>}
    />
  ),
};

export const PersistentNavigation: Story = {
  render: () => (
    <AppShell
      sidebarHeader={<SidebarLabel>Example workspace</SidebarLabel>}
      sidebar={
        <Navigation label="Collections">
          {Array.from({ length: 18 }, (_, index) => `Collection ${index + 1}`).map((label) => (
            <NavigationLink key={label} icon={<Folder size={16} />} href={`#${label.replaceAll(' ', '-')}`}>
              {label}
            </NavigationLink>
          ))}
        </Navigation>
      }
      footer={
        <SidebarFooter layout="navigation">
          <Navigation label="Account">
            <NavigationLink icon={<Settings size={16} />} href="#account-settings">
              Account settings
            </NavigationLink>
            <NavigationItem icon={<LogOut size={16} />}>Sign out</NavigationItem>
          </Navigation>
        </SidebarFooter>
      }
    >
      <PageToolbar title="Collections" />
      <DetailPage>
        <Muted>The account controls remain below the scrolling collection list.</Muted>
      </DetailPage>
    </AppShell>
  ),
};
