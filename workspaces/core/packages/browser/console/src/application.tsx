import { Button, Heading, Muted, Stack } from '@mechane-ai/elements';
import { EmptyState, Notice } from '@mechane-ai/elements/feedback';
import { isSignedOut, loadSession, problemMessage } from '@mechane/console-data';
import type { Session } from '@mechane/console-data';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ConsoleEntrance, ConsolePending, Welcome } from './entrance.tsx';
import type { ConsoleNavigation } from './types.ts';
import { WorkspaceScreen } from './workspace.tsx';

type SessionState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'signed-out' }
  | { readonly kind: 'failed'; readonly error: unknown; readonly retrying: boolean }
  | { readonly kind: 'ready'; readonly session: Session };

export function ConsoleApplication({ location, navigate }: ConsoleNavigation): ReactNode {
  const [state, setState] = useState<SessionState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  function reconnect(): void {
    setState((previous) => (previous.kind === 'failed' ? { ...previous, retrying: true } : { kind: 'loading' }));
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
          setState(isSignedOut(error) ? { kind: 'signed-out' } : { kind: 'failed', error, retrying: false });
        }
      },
    );

    return () => controller.abort();
  }, [attempt]);

  if (state.kind === 'loading') {
    return <ConsolePending />;
  }

  if (state.kind === 'signed-out') {
    return <Welcome />;
  }

  if (state.kind === 'failed') {
    return (
      <ConsoleEntrance>
        <Stack>
          <Notice error>{problemMessage(state.error)}</Notice>
          <Button onClick={reconnect} pending={state.retrying} pendingLabel="Trying again…">
            Try again
          </Button>
        </Stack>
      </ConsoleEntrance>
    );
  }

  return (
    <WorkspaceSelection
      key={state.session.principal.id}
      session={state.session}
      location={location}
      navigate={navigate}
      reconnect={reconnect}
    />
  );
}

function WorkspaceSelection({
  session,
  location,
  navigate,
  reconnect,
}: ConsoleNavigation & { readonly session: Session; readonly reconnect: () => void }): ReactNode {
  const preferenceKey = `mechane:workspace:${session.principal.id}`;

  const [preferred] = useState(() => {
    try {
      return localStorage.getItem(preferenceKey);
    } catch {
      // Storage can be disabled independently of an authenticated browser session.
      return null;
    }
  });

  const remembered = session.workspaces.find((candidate) => candidate.id === preferred);
  const shared = session.workspaces.slice(1);
  const defaultWorkspace = shared.length === 1 ? shared[0] : shared.length === 0 ? session.workspaces[0] : undefined;
  const selectedId = location.workspace ?? remembered?.id ?? defaultWorkspace?.id;
  const workspace = session.workspaces.find((candidate) => candidate.id === selectedId);

  useEffect(() => {
    if (workspace === undefined) {
      return;
    }

    try {
      localStorage.setItem(preferenceKey, workspace.id);
    } catch {
      // A blocked preference store must not prevent opening an admitted workspace.
    }
  }, [preferenceKey, workspace]);

  if (selectedId === undefined) {
    return (
      <ConsoleEntrance>
        <Stack>
          <Heading>Choose a workspace</Heading>
          <Muted>Your choice will be remembered on this browser.</Muted>
          {[...shared, session.workspaces[0]].map((candidate) => (
            <Button key={candidate.id} onClick={() => navigate({ workspace: candidate.id })}>
              {candidate.id === session.workspaces[0].id ? `Personal · ${candidate.name}` : candidate.name}
            </Button>
          ))}
        </Stack>
      </ConsoleEntrance>
    );
  }

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
    <WorkspaceScreen
      key={`${session.principal.id}:${workspace.id}`}
      session={session}
      workspace={workspace}
      location={location}
      navigate={navigate}
      onSessionEnded={reconnect}
    />
  );
}
