import type { Workspace } from '@mechane/protocol';
import { HttpMethod } from '@mechane/records';
import {
  Brand,
  Button,
  Identifier,
  Layout,
  Muted,
  Navigation,
  NavigationItem,
  SelectField,
  Stack,
  TextLink,
} from '@mechane/ui';
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
      header={<span>{workspaces.find((workspace) => workspace.id === workspaceId)?.name} / Console</span>}
      sidebar={
        <>
          <Brand />
          <SelectField label="Workspace" value={workspaceId} onChange={(event) => onWorkspace(event.target.value)}>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </SelectField>
          <Navigation>
            <NavigationItem selected onClick={onHome}>
              Mechs
            </NavigationItem>
          </Navigation>
        </>
      }
      footer={
        <Stack compact>
          <Muted>
            Signed in as <strong>{name}</strong>
          </Muted>
          <Identifier>{origin}</Identifier>
          <TextLink href="/console/THIRD_PARTY_LICENSES.txt">Open-source licenses</TextLink>
          <form method={HttpMethod.Post} action="/auth/sign-out">
            <Button type="submit" tone="quiet">
              Sign out
            </Button>
          </form>
        </Stack>
      }
    >
      {children}
    </Layout>
  );
}
