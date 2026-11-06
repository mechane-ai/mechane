import { Button } from '@mechane-ai/elements';
import { Notice } from '@mechane-ai/elements/feedback';
import { createConsoleData, problemMessage } from '@mechane/console-data';
import type { ConsoleData, Session } from '@mechane/console-data';
import { ConsoleShell, MechPagePlaceholder, MechsPagePlaceholder } from '@mechane/console-views';
import type { Workspace } from '@mechane/protocol';
import { useRouterState } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { WorkspaceDraftProvider } from './drafts.tsx';
import { initialReads } from './initial-reads.ts';
import { MechAppearanceProvider } from './mech-appearance.tsx';
import { NavigationPreferenceProvider } from './navigation-preferences.tsx';
import { ResourceView } from './resource.tsx';
import type { ResourceState } from './resource.tsx';
import { MechScreen } from './screens/mech.tsx';
import { MechsScreen } from './screens/mechs.tsx';
import { selectedTraceTab } from './screens/trace.tsx';
import { WorkspaceSettings } from './screens/workspace-settings.tsx';
import type { ConsoleNavigation } from './types.ts';
import { useScreenLifetime } from './use-screen-lifetime.ts';
import { WorkspaceAccount, WorkspaceNavigation } from './workspace-navigation.tsx';

type WorkspaceScreenProps = ConsoleNavigation & {
  readonly session: Session;
  readonly workspace: Workspace;
  readonly onSessionEnded: () => void;
};

export function WorkspaceScreen(props: WorkspaceScreenProps): ReactNode {
  const { session, workspace, location } = props;

  return (
    <MechAppearanceProvider principalId={session.principal.id} workspaceId={workspace.id}>
      <NavigationPreferenceProvider principalId={session.principal.id} workspaceId={workspace.id}>
        <WorkspaceDraftProvider mechId={location.mech}>
          <WorkspaceRuntime {...props} />
        </WorkspaceDraftProvider>
      </NavigationPreferenceProvider>
    </MechAppearanceProvider>
  );
}

function WorkspaceRuntime({ session, workspace, location, navigate, onSessionEnded }: WorkspaceScreenProps): ReactNode {
  const pages = useRouterState({ select: (state) => state.location.state.consolePages });

  const [startup] = useState(() => ({
    origin: new URL(globalThis.location.origin),
    principalId: session.principal.id,
    workspace,
    onSessionEnded,
    initialRequests: initialReads(location, pages),
  }));

  const [runtime, setRuntime] = useState<ResourceState<ConsoleData>>({ kind: 'pending' });
  const [attempt, setAttempt] = useState(0);
  const current = useRef<ConsoleData | undefined>(undefined);

  function retry(): void {
    setRuntime({ kind: 'pending' });
    setAttempt((previous) => previous + 1);
  }

  useEffect(() => {
    const controller = new AbortController();

    function isActive(): boolean {
      return !controller.signal.aborted;
    }

    void createConsoleData({ ...startup, signal: controller.signal }).then(
      async (data) => {
        if (!isActive()) {
          await data.dispose();

          return;
        }

        current.current = data;

        setRuntime({ kind: 'ready', value: data, refresh: { kind: 'idle' } });
      },
      (problem: unknown) => {
        if (isActive()) {
          setRuntime({ kind: 'failed', problem, retry, isRetrying: false });
        }
      },
    );

    return () => {
      controller.abort();
      void current.current?.dispose();
    };
  }, [attempt, startup]);

  function replace(data: ConsoleData): void {
    current.current = data;

    setRuntime({ kind: 'ready', value: data, refresh: { kind: 'idle' } });
  }

  const selected = { ...location, workspace: workspace.id };

  const placeholder =
    selected.mech === undefined ? (
      <MechsPagePlaceholder />
    ) : (
      <MechPagePlaceholder
        view={selected.view ?? 'conversation'}
        hasFocusedRun={selected.turn !== undefined}
        traceTab={selectedTraceTab(selected)}
      />
    );

  return (
    <ConsoleShell
      workspaces={session.workspaces}
      workspaceId={workspace.id}
      onWorkspace={(id) => navigate({ workspace: id })}
      shouldFocus={selected.turn !== undefined && selected.mech !== undefined}
      homeLink={runtime.kind === 'ready' ? <WorkspaceNavigation data={runtime.value} location={selected} /> : null}
      accountLink={<WorkspaceAccount workspaceId={workspace.id} name={session.principal.name} location={selected} />}
    >
      {runtime.kind === 'ready' ? (
        <WorkspaceContent
          data={runtime.value}
          session={session}
          workspace={workspace}
          location={selected}
          navigate={navigate}
          onReplace={replace}
        />
      ) : (
        <ResourceView state={runtime} placeholder={placeholder} label="Opening workspace">
          {() => null}
        </ResourceView>
      )}
    </ConsoleShell>
  );
}

function WorkspaceContent({
  data,
  session,
  workspace,
  location,
  navigate,
  onReplace,
}: ConsoleNavigation & {
  readonly data: ConsoleData;
  readonly session: Session;
  readonly workspace: Workspace;
  readonly onReplace: (data: ConsoleData) => void;
}): ReactNode {
  const subscribeHealth = useCallback((notify: () => void) => data.subscribeHealth(notify), [data]);
  const readHealth = useCallback(() => data.readHealth(), [data]);
  const health = useSyncExternalStore(subscribeHealth, readHealth, readHealth);
  const pages = useRouterState({ select: (state) => state.location.state.consolePages });
  const shouldOfferRecovery = health.issue?.kind === 'failed' && !health.isRevoked;

  const [recovery, setRecovery] = useState<{ readonly isPending: boolean; readonly problem?: unknown }>({
    isPending: false,
  });

  const isActive = useScreenLifetime();

  function continueOnline(): void {
    if (recovery.isPending) {
      return;
    }

    setRecovery({ isPending: true });

    const requests = initialReads(location, pages);

    void data.continueOnline(requests).then(
      async (replacement) => {
        if (isActive()) {
          onReplace(replacement);
          setRecovery({ isPending: false });
        } else {
          await replacement.dispose();
        }
      },
      (problem: unknown) => {
        if (isActive()) {
          setRecovery({ isPending: false, problem });
        }
      },
    );
  }

  return (
    <>
      {shouldOfferRecovery && (
        <Notice>
          This browser could not save local data.{' '}
          <Button onClick={continueOnline} isPending={recovery.isPending} pendingLabel="Continuing online…">
            Continue online
          </Button>
          {recovery.problem !== undefined && <> {problemMessage(recovery.problem)}</>}
        </Notice>
      )}
      {location.mech === undefined ? (
        location.view === 'definition' ? (
          <WorkspaceSettings data={data} session={session} workspace={workspace} />
        ) : (
          <MechsScreen data={data} onOpen={(mech) => navigate({ workspace: workspace.id, mech })} />
        )
      ) : (
        <MechScreen key={location.mech} data={data} mechId={location.mech} location={location} navigate={navigate} />
      )}
    </>
  );
}
