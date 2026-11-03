import { createConsoleData, isSignedOut, loadSession, problemMessage } from '@mechane/console-data';
import type { Session } from '@mechane/console-data';
import { ConsoleShell } from '@mechane/console-views';
import type { Workspace } from '@mechane/protocol';
import { Brand, Button, DetailPage, EmptyState, Layout, Notice, Stack, TextLink, Toolbar } from '@mechane/ui';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { MechScreen } from './screens/mech.tsx';
import { MechsScreen } from './screens/mechs.tsx';
import type { ConsoleLocation } from './types.ts';

type SessionState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'signed-out' }
  | { readonly kind: 'failed'; readonly error: unknown }
  | { readonly kind: 'ready'; readonly session: Session };

type Navigation = { readonly location: ConsoleLocation; readonly navigate: (location: ConsoleLocation) => void };

export function ConsoleApplication({ location, navigate }: Navigation): ReactNode {
  const [state, setState] = useState<SessionState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setState({ kind: 'loading' });
    void loadSession(new URL(globalThis.location.origin), controller.signal).then(
      (session) => {
        if (!controller.signal.aborted) {
          setState({ kind: 'ready', session });
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState(isSignedOut(error) ? { kind: 'signed-out' } : { kind: 'failed', error });
        }
      },
    );

    return () => controller.abort();
  }, [attempt]);

  if (state.kind !== 'ready') {
    return (
      <Layout sidebar={<Brand />}>
        <Toolbar title="Console" />
        <DetailPage>
          <EmptyState
            title={state.kind === 'loading' ? 'Connecting to Mechane…' : 'Welcome to your console'}
            action={
              state.kind === 'signed-out' ? (
                <TextLink href="/auth/sign-in">Sign in →</TextLink>
              ) : state.kind === 'failed' ? (
                <Stack>
                  <Notice error>{problemMessage(state.error)}</Notice>
                  <Button onClick={() => setAttempt((value) => value + 1)}>Try again</Button>
                </Stack>
              ) : undefined
            }
          >
            Inspect your mechs, follow their work, and manage this installation.
          </EmptyState>
        </DetailPage>
      </Layout>
    );
  }

  const workspace =
    location.workspace === undefined
      ? state.session.workspaces[0]
      : state.session.workspaces.find((candidate) => candidate.id === location.workspace);

  if (workspace === undefined) {
    return (
      <Layout sidebar={<Brand />}>
        <Toolbar title="Console" />
        <DetailPage>
          <EmptyState
            title="Workspace unavailable"
            action={<Button onClick={() => navigate({})}>Choose another workspace</Button>}
          >
            Your account no longer has access to this workspace.
          </EmptyState>
        </DetailPage>
      </Layout>
    );
  }

  return (
    <WorkspaceScreen
      key={`${state.session.principal.id}:${workspace.id}`}
      session={state.session}
      workspace={workspace}
      location={location}
      navigate={navigate}
      onSessionEnded={() => {
        setState({ kind: 'loading' });
        setAttempt((value) => value + 1);
      }}
    />
  );
}

function WorkspaceScreen({
  session,
  workspace,
  location,
  navigate,
  onSessionEnded,
}: Navigation & {
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

  const selected = useMemo(() => ({ ...location, workspace: workspace.id }), [location, workspace.id]);

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
        <MechScreen
          key={selected.mech}
          data={data}
          mechId={selected.mech}
          turnId={selected.turn}
          onBack={() => navigate({ workspace: workspace.id })}
          onTurn={(turn) =>
            navigate({
              workspace: workspace.id,
              ...(selected.mech === undefined ? {} : { mech: selected.mech }),
              ...(turn === undefined ? {} : { turn }),
            })
          }
        />
      )}
    </ConsoleShell>
  );
}
