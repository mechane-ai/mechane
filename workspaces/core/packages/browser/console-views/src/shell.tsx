import type { Workspace } from '@mechane/protocol';
import { HttpMethod } from '@mechane/records';
import { Layout, Navigation, NavigationItem, NavigationLink, SidebarAccount, SidebarBrand } from '@mechane/ui';
import { BookOpen, Bot, FileText, Layers3, LogOut } from 'lucide-react';
import type { ReactNode } from 'react';

export function ConsoleShell({
  name,
  origin,
  workspaces,
  workspaceId,
  onWorkspace,
  onHome,
  children,
}: {
  readonly name: string;
  readonly origin: string;
  readonly workspaces: ReadonlyArray<Workspace>;
  readonly workspaceId: string;
  readonly onWorkspace: (id: string) => void;
  readonly onHome: () => void;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <Layout
      sidebarHeader={
        <SidebarAccount
          label="Workspace"
          value={workspaceId}
          items={workspaces.map((workspace) => ({ value: workspace.id, label: workspace.name }))}
          onValueChange={onWorkspace}
        />
      }
      sidebar={
        <Navigation>
          <NavigationItem selected icon={<Bot size={14} strokeWidth={1.75} aria-hidden />} onClick={onHome}>
            Mechs
          </NavigationItem>
        </Navigation>
      }
      footer={
        <>
          <Navigation label="Help and account">
            <NavigationLink
              href="https://github.com/mechane-ai/mechane"
              icon={<BookOpen size={14} strokeWidth={1.75} aria-hidden />}
              target="_blank"
              rel="noreferrer"
            >
              Documentation
            </NavigationLink>
            <NavigationLink
              href="/console/THIRD_PARTY_LICENSES.txt"
              icon={<FileText size={14} strokeWidth={1.75} aria-hidden />}
            >
              Open-source licenses
            </NavigationLink>
            <form method={HttpMethod.Post} action="/auth/sign-out">
              <NavigationItem
                type="submit"
                icon={<LogOut size={14} strokeWidth={1.75} aria-hidden />}
                title={`Signed in as ${name} on ${origin}`}
              >
                Sign out
              </NavigationItem>
            </form>
          </Navigation>
          <SidebarBrand icon={<Layers3 size={16} aria-hidden />}>mechane</SidebarBrand>
        </>
      }
    >
      {children}
    </Layout>
  );
}
