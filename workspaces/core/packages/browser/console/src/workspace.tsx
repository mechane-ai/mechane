import { createConsoleData } from '@mechane/console-data';
import type { Session } from '@mechane/console-data';
import { ConsoleShell } from '@mechane/console-views';
import type { Workspace } from '@mechane/protocol';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { MechScreen } from './screens/mech.tsx';
import { MechsScreen } from './screens/mechs.tsx';
import type { ConsoleNavigation } from './types.ts';

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
      onHome={() => navigate({ workspace: workspace.id })}
    >
      {selected.mech === undefined ? (
        <MechsScreen data={data} onOpen={(mech) => navigate({ workspace: workspace.id, mech })} />
      ) : (
        <MechScreen key={selected.mech} data={data} mechId={selected.mech} location={selected} navigate={navigate} />
      )}
    </ConsoleShell>
  );
}
