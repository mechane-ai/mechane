import { isSignedOut, loadSession, problemMessage } from '@mechane/console-data';
import type { Session } from '@mechane/console-data';
import { Button, EmptyState, Notice, Stack } from '@mechane/ui';
import { lazy, Suspense, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ConsoleEntrance, Welcome } from './entrance.tsx';
import type { ConsoleNavigation } from './types.ts';

const WorkspaceScreen = lazy(() => import('./workspace.tsx').then((module) => ({ default: module.WorkspaceScreen })));

type SessionState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'signed-out' }
  | { readonly kind: 'failed'; readonly error: unknown }
  | { readonly kind: 'ready'; readonly session: Session };

export function ConsoleApplication({ location, navigate }: ConsoleNavigation): ReactNode {
  const [state, setState] = useState<SessionState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  function reconnect(): void {
    setState({ kind: 'loading' });
    setAttempt((value) => value + 1);
  }

  useEffect(() => {
    const controller = new AbortController();

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

  if (state.kind === 'loading') {
    return <ConsoleEntrance />;
  }

  if (state.kind === 'signed-out') {
    return <Welcome />;
  }

  if (state.kind === 'failed') {
    return (
      <ConsoleEntrance>
        <Stack>
          <Notice error>{problemMessage(state.error)}</Notice>
          <Button onClick={reconnect}>Try again</Button>
        </Stack>
      </ConsoleEntrance>
    );
  }

  const workspace =
    location.workspace === undefined
      ? state.session.workspaces[0]
      : state.session.workspaces.find((candidate) => candidate.id === location.workspace);

  if (workspace === undefined) {
    return (
      <ConsoleEntrance>
        <EmptyState
          title="Workspace unavailable"
          action={<Button onClick={() => navigate({})}>Choose another workspace</Button>}
        >
          Your account cannot open this workspace.
        </EmptyState>
      </ConsoleEntrance>
    );
  }

  return (
    <Suspense fallback={<ConsoleEntrance />}>
      <WorkspaceScreen
        key={`${state.session.principal.id}:${workspace.id}`}
        session={state.session}
        workspace={workspace}
        location={location}
        navigate={navigate}
        onSessionEnded={reconnect}
      />
    </Suspense>
  );
}
