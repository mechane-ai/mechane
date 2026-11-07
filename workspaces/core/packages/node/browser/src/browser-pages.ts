import { Sequence } from '@mechane/records';
import {
  BROWSER_MAX_LOGS,
  BROWSER_MAX_TABS,
  BROWSER_MAX_TARGETS,
  BROWSER_TEXT_MAX_CHARS,
  BROWSER_URL_MAX_CHARS,
  BROWSER_VIEWPORT_HEIGHT,
  BROWSER_VIEWPORT_WIDTH,
  BrowserObservationId,
} from '@mechane/sandbox-wire';
import type { BrowserLog, BrowserTab, BrowserTarget } from '@mechane/sandbox-wire';
import { Deferred, Duration, Effect, Option, Result, Schema } from 'effect';
import { randomUUID } from 'node:crypto';
import {
  AccessibilityReply,
  AttachedTarget,
  ConsoleEvent,
  CreatedTarget,
  EmptyReply,
  ExceptionEvent,
  LayoutReply,
  NavigationReply,
  NetworkEvent,
  NetworkFailureEvent,
  TargetsReply,
} from './devtools.schemas.ts';
import type { DevtoolsConnection } from './devtools.ts';
import { devtoolsCommand } from './devtools.ts';
import { BrowserFailed, BrowserFailureKind } from './errors.ts';
import type { BrowserError } from './errors.ts';

const TARGET_TEXT_MAX_CHARS = 512;
const TARGET_PAGE = 'page';
const ROLE_NONE = 'none';
const NAVIGATION_TIMEOUT = Duration.seconds(15);

const BrowserEvent = {
  Loaded: 'Page.loadEventFired',
  Navigated: 'Page.frameNavigated',
  Resized: 'Page.frameResized',
  WithinDocument: 'Page.navigatedWithinDocument',
  Console: 'Runtime.consoleAPICalled',
  Exception: 'Runtime.exceptionThrown',
  Response: 'Network.responseReceived',
  Failure: 'Network.loadingFailed',
} as const;

const VIEWPORT = { width: BROWSER_VIEWPORT_WIDTH, height: BROWSER_VIEWPORT_HEIGHT, deviceScaleFactor: 1 } as const;

type ObservedTargets = {
  readonly observationId: BrowserObservationId;
  readonly nodes: ReadonlyMap<string, number>;
  readonly viewport: LayoutReply['cssVisualViewport'];
};

type LogReading = { readonly entries: ReadonlyArray<BrowserLog>; readonly omittedEntries: number };
type AppendLogInput = { readonly kind: string; readonly text: string };
type LogBuffer = { readonly append: (input: AppendLogInput) => void; readonly read: () => LogReading };
type RememberObservationInput = { readonly observation: ObservedTargets };
type RememberPageInput = { readonly page: BrowserPage };
type PageIdentityInput = { readonly tabId: BrowserTab['tabId'] };
type BrowserConnectionInput = { readonly connection: DevtoolsConnection };
type RejectedEventInput = { readonly method: string };
type BrowserPagesInput = { readonly connection: DevtoolsConnection };
type CreateBrowserPageInput = { readonly tabId: BrowserTab['tabId']; readonly sessionId: AttachedTarget['sessionId'] };

/** Keeps one attached tab’s observation and bounded diagnostic logs for this Chromium session. */
export type BrowserPage = {
  readonly tabId: BrowserTab['tabId'];
  readonly sessionId: AttachedTarget['sessionId'];
  readonly console: LogBuffer;
  readonly network: LogBuffer;
  /** Absent before observation or after input, navigation, or viewport changes invalidate its targets. */
  readonly observation: () => Option.Option<ObservedTargets>;
  readonly rememberObservation: (input: RememberObservationInput) => void;
  readonly invalidateObservation: () => void;
  readonly prepareNavigation: () => void;
  readonly loaded: () => Effect.Effect<void>;
  readonly didLoad: () => void;
};

/** Owns attached tabs and routes protocol events to their current session identities. */
export type BrowserPages = {
  /** Absent before the tab is attached or after its attachment is forgotten. */
  readonly findPage: (input: PageIdentityInput) => Option.Option<BrowserPage>;
  readonly remember: (input: RememberPageInput) => void;
  readonly forget: (input: PageIdentityInput) => void;
  readonly checkDiagnostics: () => Effect.Effect<void, BrowserFailed>;
};

function createBrowserPage({ tabId, sessionId }: CreateBrowserPageInput): BrowserPage {
  const state = { observation: Option.none<ObservedTargets>(), loaded: Deferred.makeUnsafe<void>() };
  const observation: BrowserPage['observation'] = () => state.observation;

  const rememberObservation: BrowserPage['rememberObservation'] = ({ observation: observed }) => {
    state.observation = Option.some(observed);
  };

  const invalidateObservation: BrowserPage['invalidateObservation'] = () => {
    state.observation = Option.none();
  };

  const prepareNavigation: BrowserPage['prepareNavigation'] = () => {
    state.observation = Option.none();
    state.loaded = Deferred.makeUnsafe<void>();
  };

  const loaded: BrowserPage['loaded'] = () => Deferred.await(state.loaded);
  const didLoad: BrowserPage['didLoad'] = () => Deferred.doneUnsafe(state.loaded, Effect.void);

  return {
    tabId,
    sessionId,
    console: browserLog(),
    network: browserLog(),
    observation,
    rememberObservation,
    invalidateObservation,
    prepareNavigation,
    loaded,
    didLoad,
  };
}

function browserLog(): LogBuffer {
  const entries: Array<BrowserLog> = [];
  const state = { omittedEntries: 0, sequence: 0 };

  const append: LogBuffer['append'] = ({ kind, text }) => {
    state.sequence += 1;

    const shortenedKind = kind.slice(0, BROWSER_TEXT_MAX_CHARS);
    const shortenedText = text.slice(0, BROWSER_TEXT_MAX_CHARS);

    const sequence = Sequence.make(state.sequence);

    entries.push({ sequence, kind: shortenedKind, text: shortenedText });

    if (entries.length > BROWSER_MAX_LOGS) {
      entries.shift();

      state.omittedEntries += 1;
    }
  };

  const read: LogBuffer['read'] = () => ({ entries: [...entries], omittedEntries: state.omittedEntries });

  return { append, read };
}

/** Routes Chromium events into per-tab observations and bounded console and network tails. */
export function browserPages({ connection }: BrowserPagesInput): BrowserPages {
  const pages = new Map<BrowserTab['tabId'], BrowserPage>();
  const state = { failure: Option.none<BrowserFailed>() };

  function rejectEvent({ method }: RejectedEventInput): void {
    if (Option.isSome(state.failure)) {
      return;
    }

    const failure = new BrowserFailed({
      kind: BrowserFailureKind.Protocol,
      reason: `Chromium event ${method} has an invalid payload; browser diagnostics are incomplete`,
    });

    state.failure = Option.some(failure);
  }

  const listener: Parameters<DevtoolsConnection['observe']>[0]['listener'] = ({ method, params, sessionId }) => {
    const known = pages.values();
    const available = Array.from(known);
    const found = available.find((candidate) => candidate.sessionId === sessionId);
    const current = Option.fromNullishOr(found);

    if (Option.isNone(current)) {
      return;
    }

    const page = current.value;

    switch (method) {
      case BrowserEvent.Loaded:
        page.didLoad();

        break;
      case BrowserEvent.Navigated:
      case BrowserEvent.Resized:
      case BrowserEvent.WithinDocument:
        page.invalidateObservation();

        break;
      case BrowserEvent.Console: {
        const decoded = Schema.decodeUnknownResult(ConsoleEvent, { onExcessProperty: 'error' })(params);

        if (Result.isFailure(decoded)) {
          rejectEvent({ method });

          return;
        }

        const describe: (value: ConsoleEvent['args'][number]) => string = (value) => {
          const description = Option.fromNullishOr(value.description);

          return Option.getOrElse(description, () => String(value.value));
        };

        const text = decoded.success.args.map(describe).join(' ');

        page.console.append({ kind: decoded.success.type, text });

        break;
      }
      case BrowserEvent.Exception: {
        const decoded = Schema.decodeUnknownResult(ExceptionEvent, { onExcessProperty: 'error' })(params);

        if (Result.isFailure(decoded)) {
          rejectEvent({ method });

          return;
        }

        const exception = decoded.success.exceptionDetails;

        const remote = Option.fromNullishOr(exception.exception);
        const description = Option.flatMap(remote, (value) => Option.fromNullishOr(value.description));
        const text = Option.getOrElse(description, () => exception.text);

        page.console.append({ kind: 'exception', text });

        break;
      }
      case BrowserEvent.Response: {
        const decoded = Schema.decodeUnknownResult(NetworkEvent, { onExcessProperty: 'error' })(params);

        if (Result.isFailure(decoded)) {
          rejectEvent({ method });

          return;
        }

        const response = decoded.success.response;

        page.network.append({ kind: 'response', text: `${response.status} ${response.mimeType} ${response.url}` });

        break;
      }
      case BrowserEvent.Failure: {
        const decoded = Schema.decodeUnknownResult(NetworkFailureEvent, { onExcessProperty: 'error' })(params);

        if (Result.isFailure(decoded)) {
          rejectEvent({ method });

          return;
        }

        page.network.append({ kind: 'failed', text: decoded.success.errorText });

        break;
      }
      default:
        break;
    }
  };

  connection.observe({ listener });

  const remember: BrowserPages['remember'] = ({ page }) => {
    pages.set(page.tabId, page);
  };

  const forget: BrowserPages['forget'] = ({ tabId }) => {
    pages.delete(tabId);
  };

  const findPage: BrowserPages['findPage'] = ({ tabId }) => {
    const page = pages.get(tabId);

    return Option.fromNullishOr(page);
  };

  const checkDiagnostics: BrowserPages['checkDiagnostics'] = Effect.fn('checkDiagnostics')(
    function* (): Effect.fn.Return<void, BrowserFailed> {
      if (Option.isSome(state.failure)) {
        return yield* state.failure.value;
      }
    },
  );

  return { findPage, remember, forget, checkDiagnostics };
}

/** Reads live page targets from Chromium rather than treating cached attachments as open tabs. */
export const listBrowserTabs = Effect.fn('listBrowserTabs')(function* ({
  connection,
}: BrowserConnectionInput): Effect.fn.Return<ReadonlyArray<BrowserTab>, BrowserError> {
  const sessionId = Option.none();

  const response = yield* devtoolsCommand({
    connection,
    sessionId,
    method: 'Target.getTargets',
    params: {},
    schema: TargetsReply,
  });

  const targets = response.targetInfos.filter((target) => target.type === TARGET_PAGE);

  if (targets.length > BROWSER_MAX_TABS) {
    return yield* new BrowserFailed({
      kind: BrowserFailureKind.Capacity,
      reason: `browser exceeds its ${BROWSER_MAX_TABS} tab limit; close unused tabs`,
    });
  }

  return targets.map((target) => ({
    tabId: target.targetId,
    url: target.url.slice(0, BROWSER_URL_MAX_CHARS),
    title: target.title.slice(0, BROWSER_TEXT_MAX_CHARS),
    viewport: VIEWPORT,
  }));
});

type BrowserTabInput = BrowserConnectionInput & PageIdentityInput;
type BrowserPageInput = BrowserTabInput & { readonly pages: BrowserPages };

/** Requires the named tab to remain present before returning its current URL and title. */
export const readBrowserTab = Effect.fn('readBrowserTab')(function* ({
  connection,
  tabId,
}: BrowserTabInput): Effect.fn.Return<BrowserTab, BrowserError> {
  const tabs = yield* listBrowserTabs({ connection });
  const found = tabs.find((candidate) => candidate.tabId === tabId);
  const tab = Option.fromNullishOr(found);

  if (Option.isNone(tab)) {
    return yield* new BrowserFailed({
      kind: BrowserFailureKind.Target,
      reason: `browser tab ${tabId} no longer exists`,
    });
  }

  return tab.value;
});

/** Enables observation domains once per tab and applies the shared viewport used by screenshots and clicks. */
export const attachBrowserPage = Effect.fn('attachBrowserPage')(function* ({
  connection,
  pages,
  tabId,
}: BrowserPageInput): Effect.fn.Return<BrowserPage, BrowserError> {
  const existing = pages.findPage({ tabId });

  if (Option.isSome(existing)) {
    return existing.value;
  }

  yield* readBrowserTab({ connection, tabId });

  const noSession = Option.none();

  const attached = yield* devtoolsCommand({
    connection,
    sessionId: noSession,
    method: 'Target.attachToTarget',
    params: { targetId: tabId, flatten: true },
    schema: AttachedTarget,
  });

  const page = createBrowserPage({ tabId, sessionId: attached.sessionId });

  pages.remember({ page });

  const sessionId = Option.some(page.sessionId);

  for (const method of ['Page.enable', 'Runtime.enable', 'Network.enable', 'Accessibility.enable']) {
    yield* devtoolsCommand({ connection, sessionId, method, params: {}, schema: EmptyReply });
  }

  yield* devtoolsCommand({
    connection,
    sessionId,
    method: 'Emulation.setDeviceMetricsOverride',
    params: { ...VIEWPORT, mobile: false },
    schema: EmptyReply,
  });

  return page;
});

type OpenBrowserTabInput = BrowserConnectionInput & { readonly pages: BrowserPages; readonly url: string };

/** Creates an attached page before navigation so loading and diagnostic events are observable. */
export const openBrowserTab = Effect.fn('openBrowserTab')(function* ({
  connection,
  pages,
  url,
}: OpenBrowserTabInput): Effect.fn.Return<BrowserTab, BrowserError> {
  const tabs = yield* listBrowserTabs({ connection });

  if (tabs.length >= BROWSER_MAX_TABS) {
    return yield* new BrowserFailed({ kind: BrowserFailureKind.Capacity, reason: 'browser tab limit reached' });
  }

  const noSession = Option.none();

  const created = yield* devtoolsCommand({
    connection,
    sessionId: noSession,
    method: 'Target.createTarget',
    params: { url: 'about:blank' },
    schema: CreatedTarget,
  });

  const page = yield* attachBrowserPage({ connection, pages, tabId: created.targetId });

  yield* navigateBrowserPage({ connection, page, url });

  return yield* readBrowserTab({ connection, tabId: created.targetId });
});

type NavigateBrowserPageInput = BrowserConnectionInput & { readonly page: BrowserPage; readonly url: string };

/** Invalidates prior targets and waits for the requested navigation within a bounded deadline. */
export const navigateBrowserPage = Effect.fn('navigateBrowserPage')(function* ({
  connection,
  page,
  url,
}: NavigateBrowserPageInput): Effect.fn.Return<void, BrowserError> {
  page.prepareNavigation();

  const sessionId = Option.some(page.sessionId);

  const response = yield* devtoolsCommand({
    connection,
    sessionId,
    method: 'Page.navigate',
    params: { url },
    schema: NavigationReply,
  });

  const errorText = Option.fromNullishOr(response.errorText);

  if (Option.isSome(errorText)) {
    return yield* new BrowserFailed({
      kind: BrowserFailureKind.Target,
      reason: `browser navigation failed: ${errorText.value}`,
    });
  }

  const loaderId = Option.fromNullishOr(response.loaderId);

  if (Option.isSome(loaderId)) {
    const failure = new BrowserFailed({
      kind: BrowserFailureKind.Target,
      reason: 'browser navigation did not finish within its deadline; observe the current tab',
    });

    const failed = Result.fail(failure);

    yield* page
      .loaded()
      .pipe(Effect.timeoutOrElse({ duration: NAVIGATION_TIMEOUT, orElse: () => Effect.fromResult(failed) }));
  }
});

export type ObserveBrowserPageInput = BrowserConnectionInput & { readonly page: BrowserPage };

type BrowserObservation = {
  readonly observationId: BrowserObservationId;
  readonly targets: ReadonlyArray<BrowserTarget>;
  readonly isTruncated: boolean;
};

/** Assigns temporary references to Chromium accessibility nodes and records their viewport for later clicks. */
export const observeBrowserPage = Effect.fn('observeBrowserPage')(function* ({
  connection,
  page,
}: ObserveBrowserPageInput): Effect.fn.Return<BrowserObservation, BrowserError> {
  const sessionId = Option.some(page.sessionId);

  const response = yield* devtoolsCommand({
    connection,
    sessionId,
    method: 'Accessibility.getFullAXTree',
    params: {},
    schema: AccessibilityReply,
  });

  const candidate: (node: AccessibilityReply['nodes'][number]) => ReadonlyArray<AccessibleCandidate> = (node) => {
    const backendNodeId = Option.fromNullishOr(node.backendDOMNodeId);
    const role = accessibleValueText({ value: node.role });
    const isIgnored = node.ignored;

    if (isIgnored || Option.isNone(backendNodeId) || role === ROLE_NONE) {
      return [];
    }

    return [{ backendNodeId: backendNodeId.value, role, node }];
  };

  const visible = response.nodes.flatMap(candidate);
  const selected = visible.slice(0, BROWSER_MAX_TARGETS);

  const prepared = selected.map((current, index) => {
    const reference = `e${index + 1}`;
    const name = accessibleValueText({ value: current.node.name });
    const value = accessibleValueText({ value: current.node.value });
    const target: BrowserTarget = { reference, role: current.role, name, value };

    return { target, backendNodeId: current.backendNodeId };
  });

  const targets = prepared.map((current) => current.target);
  const nodeEntries = prepared.map((current) => [current.target.reference, current.backendNodeId] as const);
  const nodes = new Map(nodeEntries);

  const layout = yield* devtoolsCommand({
    connection,
    sessionId,
    method: 'Page.getLayoutMetrics',
    params: {},
    schema: LayoutReply,
  });

  const observationId = BrowserObservationId.make(randomUUID());

  page.rememberObservation({ observation: { observationId, nodes, viewport: layout.cssVisualViewport } });

  return { observationId, targets, isTruncated: visible.length > targets.length };
});

type AccessibleCandidate = {
  readonly backendNodeId: number;
  readonly role: string;
  readonly node: AccessibilityReply['nodes'][number];
};

type AccessibleTextInput = { readonly value: AccessibilityReply['nodes'][number]['role'] };

function accessibleValueText({ value }: AccessibleTextInput): string {
  const entry = Option.fromNullishOr(value);
  const present = Option.flatMap(entry, (entryValue) => Option.fromNullishOr(entryValue.value));
  const text = Option.map(present, String);

  return Option.getOrElse(text, () => '').slice(0, TARGET_TEXT_MAX_CHARS);
}
