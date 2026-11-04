import type { Meta, StoryObj } from '@storybook/react-vite';
import { FileText, Folder, Save } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Muted, Stack, Subheading, Text } from '../../core/src/index.ts';
import { Input, SettingsRow, SettingsSection, Switch } from '../../forms/src/index.ts';
import { PageNavigation } from '../../navigation/src/index.ts';
import { AppShell } from './app-shell.tsx';
import { ToolbarAction } from './page-toolbar.tsx';
import { RecordPage } from './record-page.tsx';
import { Navigation, NavigationLink, SidebarLabel } from './sidebar.tsx';

const meta = {
  title: 'Layout/RecordPage',
  component: RecordPage.Root,
  subcomponents: {
    Toolbar: RecordPage.Toolbar,
    Body: RecordPage.Body,
    Content: RecordPage.Content,
    Header: RecordPage.Header,
    Aside: RecordPage.Aside,
    SettingsSection,
    SettingsRow,
    PageNavigation,
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Supported. RecordPage composes a record toolbar, focusable heading, content, and optional properties. Put Header and the main content inside Content, with Aside as its sibling inside Body. Body shares DetailPage sizing and wraps the aside when the columns no longer fit. Toolbar reuses PageToolbar and its sidebar toggle; place it once inside AppShell. Applications supply routing, record data, actions, and titleRef when a completed route change should focus the heading. Use DetailPage alone when only a centered content container is needed. SettingsSection groups existing SettingsRow controls without a second card or row style; applications own drafts, labels, validation, and saving. Use Field for compact forms. PageNavigation links to independent pages using href and aria-current; optional onNavigate intercepts only unmodified activation. Use Tabs for panels within one page. The application supplies stable item IDs, selectedId, destinations, and navigation. Set embedded when a surrounding region already owns the bottom separator.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const pages = [
  { id: 'overview', label: 'Overview', href: '#example-record-overview' },
  { id: 'history', label: 'History', href: '#example-record-history' },
  { id: 'sharing', label: 'Sharing', href: '#example-record-sharing' },
];

function RecordExample(): ReactNode {
  const [selectedId, setSelectedId] = useState('overview');
  const titleRef = useRef<HTMLHeadingElement>(null);

  return (
    <AppShell
      sidebarHeader={<SidebarLabel>Example workspace</SidebarLabel>}
      sidebar={
        <Navigation label="Workspace">
          <NavigationLink href="#example-records" icon={<Folder size={16} />} selected>
            Records
          </NavigationLink>
        </Navigation>
      }
    >
      <RecordPage.Root>
        <RecordPage.Toolbar
          backLabel="Records"
          backHref="#example-records"
          actions={<ToolbarAction icon={<Save size={16} aria-hidden />}>Save changes</ToolbarAction>}
        />
        <RecordPage.Body>
          <RecordPage.Content>
            <RecordPage.Header
              title="Release checklist"
              description="A shared document for preparing the next release."
              icon={<FileText size={24} />}
              titleRef={titleRef}
            />
            <PageNavigation label="Record pages" items={pages} selectedId={selectedId} onNavigate={setSelectedId} />
            <SettingsSection title="Document" description="The application owns the draft and save action.">
              <SettingsRow label="Name" controlId="record-example-name">
                <Input id="record-example-name" defaultValue="Release checklist" />
              </SettingsRow>
              <SettingsRow label="Notify reviewers" controlId="record-example-notifications">
                <Switch.Root id="record-example-notifications" defaultChecked>
                  <Switch.Thumb />
                </Switch.Root>
              </SettingsRow>
            </SettingsSection>
            <div>
              <Button onClick={() => titleRef.current?.focus()}>Focus record title</Button>
            </div>
          </RecordPage.Content>
          <RecordPage.Aside>
            <Stack compact>
              <Subheading>Owner</Subheading>
              <Text>Example team</Text>
            </Stack>
            <Stack compact>
              <Subheading>Review</Subheading>
              <Muted>Two reviewers can edit this document.</Muted>
            </Stack>
          </RecordPage.Aside>
        </RecordPage.Body>
      </RecordPage.Root>
    </AppShell>
  );
}

export const Recommended: Story = { render: () => <RecordExample /> };

export const StackedProperties: Story = {
  ...Recommended,
  globals: { viewport: { value: 'narrow', isRotated: false } },
};

export const WithoutProperties: Story = {
  render: () => (
    <RecordPage.Root>
      <RecordPage.Toolbar backLabel="Documents" backHref="#example-documents" />
      <RecordPage.Body>
        <RecordPage.Content>
          <RecordPage.Header
            title="An unusually long document title that remains readable when the window becomes narrow"
            description="Without an aside, the document uses the full centered content width."
          />
          <SettingsSection title="Display name">
            <SettingsRow label="Document name" controlId="single-column-name">
              <Input id="single-column-name" defaultValue="Planning document" />
            </SettingsRow>
          </SettingsSection>
        </RecordPage.Content>
      </RecordPage.Body>
    </RecordPage.Root>
  ),
};

export const PageLinks: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <Stack>
      <PageNavigation label="Document pages" items={pages} selectedId="overview" />
      <PageNavigation label="Embedded document pages" items={pages} selectedId="history" embedded />
      <Muted>These native links retain browser navigation, copying, and opening in another tab.</Muted>
    </Stack>
  ),
};
