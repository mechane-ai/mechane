import { Button } from '@mechane-ai/elements';
import { Notice } from '@mechane-ai/elements/feedback';
import { createConsoleData, isStorageFailure, problemMessage } from '@mechane/console-data';
import type { ConsoleData, ConsoleDataOwner, ViewerSession } from '@mechane/console-data';
import {
  ConsoleShell,
  ConversationPlaceholder,
  EvidencePagePlaceholder,
  ManagedEvidenceListPlaceholder,
  ManagedListPlaceholder,
} from '@mechane/console-views';
import type { Workspace } from '@mechane/protocol';
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
import { ManagedScreen } from './screens/managed.tsx';
import { WorkspaceSettings } from './screens/workspace-settings.tsx';
import type { ConsoleLocation, ConsoleNavigation, ReaderPosition } from './types.ts';
import { useScreenLifetime } from './use-screen-lifetime.ts';
import { WorkspaceAccount, WorkspaceNavigation } from './workspace-navigation.tsx';

type WorkspaceScreenProps = ConsoleNavigation & {
  readonly owner: ConsoleDataOwner;
  readonly session: ViewerSession;
  readonly workspace: Workspace;
  readonly onSessionEnded: () => void;
};

type WorkspaceRuntimeState =
  | { readonly kind: 'pending'; readonly data: ConsoleData | undefined }
  | { readonly kind: 'failed'; readonly data: ConsoleData | undefined; readonly problem: unknown }
  | { readonly kind: 'ready'; readonly data: ConsoleData };

type WorkspacePosition = {
  readonly href: string;
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

function workspacePlaceholder(selected: ConsoleLocation): ReactNode {
  if (selected.artifact !== undefined) {
    return <EvidencePagePlaceholder />;
  }

  if (selected.isSessionEvidence === true) {
    return <ManagedEvidenceListPlaceholder />;
  }

  if (selected.session !== undefined) {
    return <ConversationPlaceholder />;
  }

  return <ManagedListPlaceholder kind={selected.agent === undefined ? 'agents' : 'sessions'} />;
}

export function WorkspaceScreen(props: WorkspaceScreenProps): ReactNode {
  const { session, workspace, location } = props;

  return (
    <MechAppearanceProvider principalId={session.principal.id} workspaceId={workspace.id}>
      <NavigationPreferenceProvider principalId={session.principal.id} workspaceId={workspace.id}>
        <WorkspaceDraftProvider
          scope={
            location.agent === undefined
              ? undefined
              : JSON.stringify([location.agent, location.session, location.thread])
          }
        >
          <WorkspaceRuntime {...props} />
        </WorkspaceDraftProvider>
      </NavigationPreferenceProvider>
    </MechAppearanceProvider>
  );
}

function WorkspaceRuntime({
  owner,
  session,
  workspace,
  location,
  navigate,
  onSessionEnded,
}: WorkspaceScreenProps): ReactNode {
  const [runtime, setRuntime] = useState<WorkspaceRuntimeState>({ kind: 'pending', data: undefined });
  const [attempt, setAttempt] = useState(0);
  const current = useRef<ConsoleData | undefined>(undefined);
  const lifetime = useRef<AbortController | undefined>(undefined);
  const position = useRef<WorkspacePosition | undefined>(undefined);
  const hasRecoveredAutomatically = useRef(false);

  const claimAutomaticRecovery = useCallback(() => {
    if (hasRecoveredAutomatically.current) {
      return false;
    }

    hasRecoveredAutomatically.current = true;

    return true;
  }, []);

  function retry(): void {
    setRuntime((previous) => ({ kind: 'pending', data: previous.data }));
    setAttempt((previous) => previous + 1);
  }

  const openRuntime = useEffectEvent(() => {
    const controller = new AbortController();

    lifetime.current = controller;

    void createConsoleData({
      owner,
      origin: new URL(globalThis.location.origin),
      principalId: session.principal.id,
      workspace,
      onSessionEnded,
      initialRequests: initialReads(location),
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
          if (isStorageFailure(problem) && claimAutomaticRecovery()) {
            retry();
          } else {
            setRuntime((previous) => ({ kind: 'failed', data: previous.data, problem }));
          }
        }
      },
    );
  });

  const savePosition = useEffectEvent(() => {
    position.current = {
      href: globalThis.location.href,
      focus: document.activeElement instanceof HTMLElement ? document.activeElement : undefined,
      focusSelector: focusSelector(document.activeElement),
      readers: readReaderPositions(),
    };
  });

  useEffect(() => {
    function closeRuntime(options?: { readonly isPageHide?: boolean }): void {
      lifetime.current?.abort();
      void current.current?.dispose(options);

      current.current = undefined;
    }

    function onPageHide(): void {
      if (current.current !== undefined) {
        savePosition();
      }

      closeRuntime({ isPageHide: true });

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

    if (target.href !== globalThis.location.href) {
      position.current = undefined;

      return;
    }

    const controller = new AbortController();
    const frames = new Set<number>();
    const data = runtime.data;
    const requests = initialReads(location);
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
  }, [location, runtime]);

  function replace(previous: ConsoleData, data: ConsoleData): void {
    if (current.current !== previous) {
      void data.dispose();

      return;
    }

    current.current = data;

    setRuntime({ kind: 'ready', data });
    void previous.dispose();
  }

  const selected = { ...location, workspace: workspace.id };

  const placeholder = workspacePlaceholder(selected);

  return (
    <ConsoleShell
      workspaces={session.workspaces}
      workspaceId={workspace.id}
      onWorkspace={(id) => navigate({ workspace: id })}
      shouldFocus={selected.artifact !== undefined}
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
            location={selected}
            navigate={navigate}
            onReplace={replace}
            claimAutomaticRecovery={claimAutomaticRecovery}
            onRecoveryStarted={() => {
              position.current = {
                href: globalThis.location.href,
                focus: document.activeElement instanceof HTMLElement ? document.activeElement : undefined,
                focusSelector: focusSelector(document.activeElement),
                readers: readReaderPositions(),
              };
            }}
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
  location,
  navigate,
  onReplace,
  claimAutomaticRecovery,
  onRecoveryStarted,
}: ConsoleNavigation & {
  readonly data: ConsoleData;
  readonly session: ViewerSession;
  readonly onReplace: (previous: ConsoleData, data: ConsoleData) => void;
  readonly claimAutomaticRecovery: () => boolean;
  readonly onRecoveryStarted: () => void;
}): ReactNode {
  const subscribeHealth = useCallback((notify: () => void) => data.subscribeHealth(notify), [data]);
  const readHealth = useCallback(() => data.readHealth(), [data]);
  const health = useSyncExternalStore(subscribeHealth, readHealth, readHealth);
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
  const recoveryTarget = useRef(location);

  useLayoutEffect(() => {
    recoveryTarget.current = location;
  }, [location]);

  function recover(): void {
    if (recovery.isPending) {
      return;
    }

    onRecoveryStarted();
    setRecovery({ data, isPending: true });

    const requests = initialReads(location);

    async function openReplacement(): Promise<ConsoleData> {
      const replacement = await data.recover(requests);

      try {
        while (isActive()) {
          const target = recoveryTarget.current;
          const primary = initialReads(target);

          await Promise.all(primary.map((request) => replacement.ready(request)));

          if (target === recoveryTarget.current) {
            return replacement;
          }
        }

        return replacement;
      } catch (error) {
        await replacement.dispose();

        throw error;
      }
    }

    void openReplacement().then(
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

  const recoverAutomatically = useEffectEvent(() => {
    const currentHealth = data.readHealth();
    const canRecover = currentHealth.issue?.kind === 'failed' && !currentHealth.isRevoked;

    if (!isActive() || !canRecover || recovery.isPending) {
      return;
    }

    if (claimAutomaticRecovery()) {
      recover();
    }
  });

  useEffect(() => {
    const unsubscribe = data.subscribeHealth(() => recoverAutomatically());

    queueMicrotask(() => recoverAutomatically());

    return unsubscribe;
  }, [data]);

  return (
    <>
      {shouldOfferRecovery && (
        <Notice>
          {recovery.isPending
            ? 'Reopening local storage. Your draft is kept.'
            : 'Local storage needs to be reopened. Your draft is kept.'}{' '}
          <Button onClick={recover} isPending={recovery.isPending} pendingLabel="Reopening…">
            Reopen storage
          </Button>
          {recovery.problem !== undefined && <> {problemMessage(recovery.problem)}</>}
        </Notice>
      )}
      {location.view === 'definition' ? (
        <WorkspaceSettings data={data} session={session} workspace={data.workspace} />
      ) : (
        <ManagedScreen
          key={JSON.stringify([location.agent, location.session, location.thread])}
          data={data}
          location={location}
          navigate={navigate}
        />
      )}
    </>
  );
}
