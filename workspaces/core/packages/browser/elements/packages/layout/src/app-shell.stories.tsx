import type { Meta, StoryObj } from '@storybook/react-vite';
import { Archive, FileText, Folder, LayoutGrid, LogOut, Plus, RefreshCw, Server, Settings } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Avatar, Button, Heading, Muted, Panel, Stack } from '../../core/src/index.ts';
import { Menu } from '../../overlays/src/index.ts';
import { AppShell } from './app-shell.tsx';
import { DetailPage } from './detail-page.tsx';
import { NavigationRailMenu } from './navigation-rail-menu.tsx';
import { NavigationRail } from './navigation-rail.tsx';
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
    NavigationRail,
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Supported. AppShell owns the expanded sidebar, collapsed rail, and phone drawer. Supplying rail adds a permanent area rail beside the contextual sidebar. NavigationRail takes ordered links, the current area, and an optional action. The application owns URLs, selection, routing, preloading, and the action. A rail uses icon links with managed tooltips on desktop and visible labels in the drawer. The toolbar toggle hides the contextual sidebar while retaining the rail. Without rail, collapse shows each page icon. Focus mode hides navigation while retaining the expansion preference. Navigation groups NavigationLink destinations or NavigationItem actions; NavigationSection labels related groups. SidebarLabel hides supporting text on the collapsed sidebar. SidebarFooter groups persistent controls in the contextual pane. PageToolbar owns its outer border, optional leading control, and view choices. ToolbarAction supplies resource actions with concise labels. DetailPage centers a form or detail view; tables stay flush in the main area. Inspect the final item in a short viewport, use the phone examples to inspect dismissal and focus, and open the desktop icon tooltips with pointer and keyboard.',
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

const areas = [
  { label: 'Workspace', icon: <LayoutGrid size={16} aria-hidden />, pages: ['Overview', 'People', 'Tools'] },
  {
    label: 'Infra',
    icon: <Server size={16} aria-hidden />,
    pages: ['Systems', 'Previews', ...Array.from({ length: 16 }, (_, index) => `Environment ${index + 1}`)],
  },
  {
    label: 'Settings',
    icon: <Settings size={16} aria-hidden />,
    pages: ['My profile', 'Preferences', 'Connected accounts'],
  },
] as const;

function AreaShell(): ReactNode {
  const [area, setArea] = useState<(typeof areas)[number]>(areas[0]);
  const [page, setPage] = useState<string>(areas[0].pages[0]);
  const [shouldFocus, setShouldFocus] = useState(false);
  const [isSignedOut, setIsSignedOut] = useState(false);

  if (isSignedOut) {
    return <Button onClick={() => setIsSignedOut(false)}>Return to workspace</Button>;
  }

  return (
    <AppShell
      shouldFocus={shouldFocus}
      rail={
        <NavigationRail
          label="Workspace areas"
          links={areas.map((item) => ({
            label: item.label,
            icon: item.icon,
            href: `#${item.label.toLowerCase()}`,
            isCurrent: item === area,
            onClick: (event) => {
              const hasCommandModifier = event.metaKey || event.ctrlKey;
              const hasAlternateModifier = event.shiftKey || event.altKey;

              if (event.button !== 0 || hasCommandModifier || hasAlternateModifier) {
                return;
              }

              event.preventDefault();
              setArea(item);
              setPage(item.pages[0]);
            },
          }))}
        />
      }
      railFooter={
        <NavigationRailMenu
          label="Account menu, PO"
          icon={<Avatar label="Preview Operator" fallback="PO" size="sm" shape="circle" />}
        >
          <Menu.Group>
            <Menu.GroupLabel>Preview Operator</Menu.GroupLabel>
            <Menu.Separator />
            <Menu.Item onClick={() => setIsSignedOut(true)}>
              <LogOut size={16} aria-hidden />
              Sign out
            </Menu.Item>
          </Menu.Group>
        </NavigationRailMenu>
      }
      sidebarHeader={<SidebarLabel>{area.label}</SidebarLabel>}
      sidebar={
        <Navigation label="Pages">
          {area.pages.map((name) => (
            <NavigationLink
              key={name}
              href={`#${name.toLowerCase().replaceAll(' ', '-')}`}
              icon={<FileText size={16} aria-hidden />}
              isSelected={page === name}
              onClick={(event) => {
                const hasCommandModifier = event.metaKey || event.ctrlKey;
                const hasAlternateModifier = event.shiftKey || event.altKey;

                if (event.button !== 0 || hasCommandModifier || hasAlternateModifier) {
                  return;
                }

                event.preventDefault();
                setPage(name);
              }}
            >
              {name}
            </NavigationLink>
          ))}
        </Navigation>
      }
    >
      <PageToolbar
        title={page}
        showNavigation={!shouldFocus}
        actions={
          <ToolbarAction onClick={() => setShouldFocus((value) => !value)}>
            {shouldFocus ? 'Leave focus mode' : 'Enter focus mode'}
          </ToolbarAction>
        }
      />
      <DetailPage>
        <Muted>Switch areas, collapse the page list, or open navigation on a phone.</Muted>
      </DetailPage>
    </AppShell>
  );
}

export const AreaNavigation: Story = { render: () => <AreaShell /> };

export const PhoneAreaNavigation: Story = {
  ...AreaNavigation,
  globals: { viewport: { value: 'narrow', isRotated: false } },
};

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
