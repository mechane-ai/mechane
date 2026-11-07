import { Button } from '@mechane-ai/elements';
import { Notice } from '@mechane-ai/elements/feedback';
import { createConsoleData, problemMessage } from '@mechane/console-data';
import type { ConsoleData, Session } from '@mechane/console-data';
import { ConsoleShell, MechPagePlaceholder, MechsPagePlaceholder } from '@mechane/console-views';
import type { Workspace } from '@mechane/protocol';
import { useRouterState } from '@tanstack/react-router';
import {
  Activity,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { WorkspaceDraftProvider } from './drafts.tsx';
import { initialReads } from './initial-reads.ts';
import { MechAppearanceProvider } from './mech-appearance.tsx';
import { NavigationPreferenceProvider } from './navigation-preferences.tsx';
import { readReaderPositions, restoreReaderPositions } from './navigation.tsx';
import { ResourceView } from './resource.tsx';
import { MechScreen } from './screens/mech.tsx';
import { MechsScreen } from './screens/mechs.tsx';
import { selectedTraceTab } from './screens/trace.tsx';
import { WorkspaceSettings } from './screens/workspace-settings.tsx';
import type { ConsoleNavigation, ReaderPosition } from './types.ts';
import { useScreenLifetime } from './use-screen-lifetime.ts';
import { WorkspaceAccount, WorkspaceNavigation } from './workspace-navigation.tsx';

type WorkspaceScreenProps = ConsoleNavigation & {
  readonly session: Session;
  readonly workspace: Workspace;
  readonly onSessionEnded: () => void;
};

type WorkspaceRuntimeState =
  | { readonly kind: 'pending'; readonly data: ConsoleData | undefined }
  | { readonly kind: 'failed'; readonly data: ConsoleData | undefined; readonly problem: unknown }
  | { readonly kind: 'ready'; readonly data: ConsoleData };

type WorkspacePosition = {
  readonly href: string;
  readonly pages: string | undefined;
  readonly focus: HTMLElement | undefined;
  readonly focusSelector: string | undefined;
  readonly readers: ReadonlyArray<ReaderPosition>;
};

function focusSelector(element: Element | null): string | undefined {
  if (element === null) {
    return undefined;
  }

  for (const attribute of ['name', 'href', 'aria-label', 'id']) {
    const value = element.getAttribute(attribute);

    if (value !== null && value !== '') {
      return `${element.localName}[${attribute}="${CSS.escape(value)}"]`;
    }
  }

  return undefined;
}

function restoreWorkspacePosition(target: WorkspacePosition): void {
  const candidates: Array<HTMLElement> = [];

  if (target.focus?.isConnected === true) {
    candidates.push(target.focus);
  } else if (target.focusSelector !== undefined) {
    candidates.push(...document.querySelectorAll<HTMLElement>(target.focusSelector));
  }

  const visible = candidates.filter((element) => element.checkVisibility({ visibilityProperty: true }));

  if (visible.length === 1) {
    visible[0]?.focus({ preventScroll: true });
  }

  restoreReaderPositions(target.readers);
}

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

  const [runtime, setRuntime] = useState<WorkspaceRuntimeState>({ kind: 'pending', data: undefined });
  const [attempt, setAttempt] = useState(0);
  const current = useRef<ConsoleData | undefined>(undefined);
  const lifetime = useRef<AbortController | undefined>(undefined);
  const position = useRef<WorkspacePosition | undefined>(undefined);

  function retry(): void {
    setRuntime((previous) => ({ kind: 'pending', data: previous.data }));
    setAttempt((previous) => previous + 1);
  }

  const openRuntime = useEffectEvent(() => {
    const controller = new AbortController();

    lifetime.current = controller;

    void createConsoleData({
      origin: new URL(globalThis.location.origin),
      principalId: session.principal.id,
      workspace,
      onSessionEnded,
      initialRequests: initialReads(location, pages),
      signal: controller.signal,
    }).then(
      async (data) => {
        if (controller.signal.aborted) {
          await data.dispose();

          return;
        }

        current.current = data;

        setRuntime({ kind: 'ready', data });
      },
      (problem: unknown) => {
        if (!controller.signal.aborted) {
          setRuntime((previous) => ({ kind: 'failed', data: previous.data, problem }));
        }
      },
    );
  });

  const savePosition = useEffectEvent(() => {
    position.current = {
      href: globalThis.location.href,
      pages: JSON.stringify(pages),
      focus: document.activeElement instanceof HTMLElement ? document.activeElement : undefined,
      focusSelector: focusSelector(document.activeElement),
      readers: readReaderPositions(),
    };
  });

  useEffect(() => {
    function closeRuntime(): void {
      lifetime.current?.abort();
      void current.current?.dispose();

      current.current = undefined;
    }

    function onPageHide(): void {
      if (current.current !== undefined) {
        savePosition();
      }

      closeRuntime();

      // Hide protected content before the browser freezes this document's rendered snapshot.
      flushSync(() => setRuntime((previous) => ({ kind: 'pending', data: previous.data })));
    }

    function onPageShow(event: PageTransitionEvent): void {
      if (event.persisted && lifetime.current?.signal.aborted === true) {
        openRuntime();
      }
    }

    globalThis.addEventListener('pagehide', onPageHide, { capture: true });
    globalThis.addEventListener('pageshow', onPageShow);
    openRuntime();

    return () => {
      globalThis.removeEventListener('pagehide', onPageHide, true);
      globalThis.removeEventListener('pageshow', onPageShow);
      closeRuntime();
    };
  }, [attempt]);

  useLayoutEffect(() => {
    const target = position.current;

    if (runtime.kind !== 'ready' || target === undefined) {
      return;
    }

    if (target.href !== globalThis.location.href || target.pages !== JSON.stringify(pages)) {
      position.current = undefined;

      return;
    }

    const controller = new AbortController();
    const frames = new Set<number>();
    const requests = initialReads(location, pages, 'primary');
    const data = runtime.data;
    const restoreTarget = target;

    function restore(): void {
      if (controller.signal.aborted || position.current !== target) {
        return;
      }

      const frame = requestAnimationFrame(() => {
        frames.delete(frame);

        if (controller.signal.aborted || position.current !== target) {
          return;
        }

        restoreWorkspacePosition(restoreTarget);

        position.current = undefined;

        stop();
      });

      frames.add(frame);
    }

    function whenReady(): void {
      if (position.current === target) {
        void Promise.allSettled([
          Promise.all(requests.map((request) => data.ready(request, controller.signal))).then(restore),
        ]);
      }
    }

    const unsubscribe = requests.map((request) =>
      data.subscribeReadStatus(request.id, () => {
        if (data.readStatus(request)?.status === 'success') {
          whenReady();
        }
      }),
    );

    whenReady();

    function stop(): void {
      controller.abort();

      for (const unsubscribeRead of unsubscribe) {
        unsubscribeRead();
      }

      for (const frame of frames) {
        cancelAnimationFrame(frame);
      }
    }

    return stop;
  }, [location, pages, runtime]);

  function replace(previous: ConsoleData, data: ConsoleData): void {
    if (current.current !== previous) {
      void data.dispose();

      return;
    }

    current.current = data;

    setRuntime({ kind: 'ready', data });
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
      homeLink={
        runtime.data === undefined ? null : (
          <Activity mode={runtime.kind === 'ready' ? 'visible' : 'hidden'}>
            <WorkspaceNavigation data={runtime.data} location={selected} />
          </Activity>
        )
      }
      accountLink={<WorkspaceAccount workspaceId={workspace.id} name={session.principal.name} location={selected} />}
    >
      {runtime.data !== undefined && (
        <Activity mode={runtime.kind === 'ready' ? 'visible' : 'hidden'}>
          <WorkspaceContent
            data={runtime.data}
            session={session}
            workspace={workspace}
            location={selected}
            navigate={navigate}
            onReplace={replace}
          />
        </Activity>
      )}
      {runtime.kind !== 'ready' && (
        <ResourceView
          state={runtime.kind === 'failed' ? { ...runtime, retry, isRetrying: false } : runtime}
          placeholder={placeholder}
          label="Opening workspace"
        >
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
  readonly onReplace: (previous: ConsoleData, data: ConsoleData) => void;
}): ReactNode {
  const subscribeHealth = useCallback((notify: () => void) => data.subscribeHealth(notify), [data]);
  const readHealth = useCallback(() => data.readHealth(), [data]);
  const health = useSyncExternalStore(subscribeHealth, readHealth, readHealth);
  const pages = useRouterState({ select: (state) => state.location.state.consolePages });
  const shouldOfferRecovery = health.issue?.kind === 'failed' && !health.isRevoked;

  const [savedRecovery, setRecovery] = useState<{
    readonly data: ConsoleData;
    readonly isPending: boolean;
    readonly problem?: unknown;
  }>({ data, isPending: false });

  const recovery = savedRecovery.data === data ? savedRecovery : { data, isPending: false };

  if (recovery !== savedRecovery) {
    setRecovery(recovery);
  }

  const isActive = useScreenLifetime();

  function recover(): void {
    if (recovery.isPending) {
      return;
    }

    setRecovery({ data, isPending: true });

    const requests = initialReads(location, pages);

    void data.recover(requests).then(
      async (replacement) => {
        if (isActive()) {
          onReplace(data, replacement);
          setRecovery((currentRecovery) =>
            currentRecovery.data === data ? { data, isPending: false } : currentRecovery,
          );
        } else {
          await replacement.dispose();
        }
      },
      (problem: unknown) => {
        if (isActive()) {
          setRecovery((currentRecovery) =>
            currentRecovery.data === data ? { data, isPending: false, problem } : currentRecovery,
          );
        }
      },
    );
  }

  return (
    <>
      {shouldOfferRecovery && (
        <Notice>
          Local storage needs to be reopened. Your draft is kept.{' '}
          <Button onClick={recover} isPending={recovery.isPending} pendingLabel="Reopening…">
            Reopen storage
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
