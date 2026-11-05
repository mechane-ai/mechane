import { NavigationLink } from '@mechane-ai/elements/layout';
import { createConsoleData } from '@mechane/console-data';
import type { ConsoleData, Session } from '@mechane/console-data';
import { ConsoleShell } from '@mechane/console-views';
import type { Workspace } from '@mechane/protocol';
import { createLink } from '@tanstack/react-router';
import { Bot } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useResource } from './resource.tsx';
import { MechScreen } from './screens/mech.tsx';
import { MechsScreen } from './screens/mechs.tsx';
import type { ConsoleNavigation } from './types.ts';

const HomeLink = createLink(NavigationLink);

export function WorkspaceScreen({
  session,
  workspace,
  location,
  navigate,
  onSessionEnded,
}: ConsoleNavigation & {
  readonly session: Session;
  readonly workspace: Workspace;
  readonly onSessionEnded: () => void;
}): ReactNode {
  const [data] = useState(() => createConsoleData(new URL(globalThis.location.origin), workspace, onSessionEnded));

  useEffect(
    () => () => {
      void data.dispose();
    },
    [data],
  );

  const selected = { ...location, workspace: workspace.id };

  return (
    <ConsoleShell
      name={session.principal.name}
      origin={globalThis.location.host}
      workspaces={session.workspaces}
      workspaceId={workspace.id}
      onWorkspace={(id) => navigate({ workspace: id })}
      homeLink={
        <>
          <HomeLink
            to="/"
            search={{ workspace: workspace.id }}
            selected={selected.mech === undefined}
            icon={<Bot size={16} aria-hidden />}
          >
            Mechs
          </HomeLink>
          <WorkspaceMechs data={data} selectedId={selected.mech} />
        </>
      }
    >
      {selected.mech === undefined ? (
        <MechsScreen data={data} onOpen={(mech) => navigate({ workspace: workspace.id, mech })} />
      ) : (
        <MechScreen key={selected.mech} data={data} mechId={selected.mech} location={selected} navigate={navigate} />
      )}
    </ConsoleShell>
  );
}

function WorkspaceMechs({
  data,
  selectedId,
}: {
  readonly data: ConsoleData;
  readonly selectedId: string | undefined;
}): ReactNode {
  const source = useMemo(() => data.mechs(null), [data]);
  const state = useResource(data, source);

  switch (state.kind) {
    case 'pending':
    case 'failed':
      return null;
    case 'ready':
    case 'stale':
      break;
  }

  return (
    <>
      {state.value.mechs.slice(0, 12).map((mech) => (
        <HomeLink
          key={mech.id}
          to="/"
          search={{ workspace: data.workspace.id, mech: mech.id }}
          selected={selectedId === mech.id}
          icon={<Bot size={16} aria-hidden />}
        >
          {mech.name}
        </HomeLink>
      ))}
    </>
  );
}
