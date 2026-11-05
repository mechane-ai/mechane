import { createConsoleData } from '@mechane/console-data';
import type { Session } from '@mechane/console-data';
import { ConsoleShell } from '@mechane/console-views';
import type { Workspace } from '@mechane/protocol';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { MechAppearanceProvider } from './mech-appearance.tsx';
import { NavigationPreferenceProvider } from './navigation-preferences.tsx';
import { MechScreen } from './screens/mech.tsx';
import { MechsScreen } from './screens/mechs.tsx';
import { WorkspaceSettings } from './screens/workspace-settings.tsx';
import type { ConsoleNavigation } from './types.ts';
import { WorkspaceNavigation } from './workspace-navigation.tsx';

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
    <MechAppearanceProvider principalId={session.principal.id} workspaceId={workspace.id}>
      <NavigationPreferenceProvider principalId={session.principal.id} workspaceId={workspace.id}>
        <ConsoleShell
          name={session.principal.name}
          origin={globalThis.location.host}
          workspaces={session.workspaces}
          workspaceId={workspace.id}
          onWorkspace={(id) => navigate({ workspace: id })}
          focus={selected.turn !== undefined && selected.mech !== undefined}
          homeLink={<WorkspaceNavigation data={data} location={selected} />}
        >
          {selected.mech === undefined ? (
            selected.view === 'definition' ? (
              <WorkspaceSettings session={session} workspace={workspace} />
            ) : (
              <MechsScreen data={data} onOpen={(mech) => navigate({ workspace: workspace.id, mech })} />
            )
          ) : (
            <MechScreen
              key={selected.mech}
              data={data}
              mechId={selected.mech}
              location={selected}
              navigate={navigate}
            />
          )}
        </ConsoleShell>
      </NavigationPreferenceProvider>
    </MechAppearanceProvider>
  );
}
