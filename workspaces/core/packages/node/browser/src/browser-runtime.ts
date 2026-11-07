import { EvidenceArtifactId } from '@mechane/records';
import {
  BROWSER_RECORDING_MAX_DURATION,
  BROWSER_TEXT_MAX_CHARS,
  BrowserOperation,
  BrowserReceipt,
  BrowserRequest,
  BrowserResult,
} from '@mechane/sandbox-wire';
import type { BrowserRequestId, BrowserResponse } from '@mechane/sandbox-wire';
import { Deferred, Duration, Effect, FiberSet, Option, Result, Schema, Semaphore } from 'effect';
import type { Scope } from 'effect';
import { captureBrowserPreview, captureBrowserScreenshot } from './browser-artifacts.ts';
import { performBrowserInput } from './browser-input.ts';
import { trackBrowserMutations } from './browser-mutation.ts';
import {
  attachBrowserPage,
  browserPages,
  listBrowserTabs,
  navigateBrowserPage,
  observeBrowserPage,
  openBrowserTab,
  readBrowserTab,
} from './browser-pages.ts';
import type { BrowserPages } from './browser-pages.ts';
import { browserChildren, stopBrowserChildren } from './browser-process.ts';
import { startBrowserRecording, stopBrowserRecording } from './browser-recording.ts';
import type { BrowserRecording } from './browser-recording.ts';
import { boundBrowserResponse } from './browser-response.ts';
import { startChromium } from './chromium.ts';
import type { ChromiumSession } from './chromium.ts';
import { EmptyReply } from './devtools.schemas.ts';
import { devtoolsCommand } from './devtools.ts';
import { BrowserFailed, BrowserFailureKind, BrowserFailureTag } from './errors.ts';
import type { BrowserError } from './errors.ts';
import { readBrowserArtifactPart } from './store/browser-artifacts.ts';
import { readBrowserReceipt, readBrowserReceiptRecord, writeBrowserReceipt } from './store/browser-receipts.ts';
import type { BrowserRuntime, BrowserSettings } from './types.ts';

const BROWSER_PENDING_REQUESTS = 32;
const CHECKPOINT_RETRY_DELAY = Duration.millis(100);
const BrowserRequestJson = Schema.fromJsonString(BrowserRequest);

type PendingBrowserRequest = {
  readonly request: BrowserRequest;
  readonly fingerprint: string;
  readonly settled: Deferred.Deferred<BrowserResponse, BrowserFailed>;
};

type BrowserSession = { readonly chromium: ChromiumSession; readonly pages: BrowserPages };
type BrowserRequestInput = { readonly request: BrowserRequest };
type BrowserRequestIdentity = Pick<BrowserRequest, 'requestId'>;
type BrowserActionInput = BrowserRequestInput & { readonly acknowledge: () => void };
type RunBrowserActionInput = BrowserActionInput & { readonly session: BrowserSession };

/** Owns Chromium, ordered actions, immutable request receipts, and scoped recording deadlines for one guest. */
export const createBrowserRuntime = Effect.fn('createBrowserRuntime')(function* (
  settings: BrowserSettings,
): Effect.fn.Return<BrowserRuntime, BrowserFailed, Scope.Scope> {
  const children = browserChildren();

  const state = {
    session: Option.none<BrowserSession>(),
    recording: Option.none<BrowserRecording>(),
    isFinalizingRecording: false,
  };

  const pending = new Map<BrowserRequestId, PendingBrowserRequest>();
  const semaphore = yield* Semaphore.make(1);

  const close = Effect.fn('close')(function* (): Effect.fn.Return<void> {
    if (Option.isSome(state.session)) {
      state.session.value.chromium.connection.close();
    }

    yield* stopBrowserChildren({ children }).pipe(Effect.orDie);
  });

  yield* Effect.acquireRelease(Effect.void, close);

  const fibers = yield* FiberSet.make<void>();

  const ensureSession = Effect.fn('ensureSession')(function* (): Effect.fn.Return<BrowserSession, BrowserFailed> {
    if (Option.isSome(state.session)) {
      return state.session.value;
    }

    const failed = Effect.fn('failed')(function* (failure: BrowserFailed): Effect.fn.Return<never, BrowserFailed> {
      yield* stopBrowserChildren({ children });

      return yield* failure;
    });

    const chromium = yield* startChromium({ settings, children }).pipe(Effect.catchTags({ BrowserFailed: failed }));

    const pages = browserPages({ connection: chromium.connection });
    const session = { chromium, pages };

    state.session = Option.some(session);

    return session;
  });

  const runAction = Effect.fn('runAction')(function* ({
    request,
    acknowledge,
    session,
  }: RunBrowserActionInput): Effect.fn.Return<BrowserResult, BrowserError> {
    const connection = trackBrowserMutations({ connection: session.chromium.connection, acknowledge });
    const pages = session.pages;
    const chromium = { ...session.chromium, connection };
    const action = request.action;

    switch (action._tag) {
      case BrowserOperation.Tabs: {
        const tabs = yield* listBrowserTabs({ connection });

        return BrowserResult.cases.Tabs.make({ tabs });
      }
      case BrowserOperation.Open: {
        const tab = yield* openBrowserTab({ connection, pages, url: action.url });

        return BrowserResult.cases.Tab.make({ tab });
      }
      case BrowserOperation.Close:
      case BrowserOperation.Navigate:
      case BrowserOperation.Observe:
      case BrowserOperation.Screenshot:
      case BrowserOperation.Click:
      case BrowserOperation.Type:
      case BrowserOperation.Scroll:
      case BrowserOperation.Key:
      case BrowserOperation.Console:
      case BrowserOperation.Network:
      case BrowserOperation.RecordStart:
      case BrowserOperation.RecordStop:
        break;
    }

    const page = yield* attachBrowserPage({ connection, pages, tabId: action.tabId });
    const noSession = Option.none();

    switch (action._tag) {
      case BrowserOperation.Close:
        if (
          Option.isSome(state.recording) &&
          state.recording.value.tab.tabId === action.tabId &&
          !Deferred.isDoneUnsafe(state.recording.value.settled)
        ) {
          return yield* new BrowserFailed({
            kind: BrowserFailureKind.Conflict,
            reason: 'stop the active recording before closing its tab',
          });
        }

        yield* devtoolsCommand({
          connection,
          sessionId: noSession,
          method: 'Target.closeTarget',
          params: { targetId: action.tabId },
          schema: EmptyReply,
        });
        pages.forget({ tabId: action.tabId });

        return BrowserResult.cases.Closed.make({ tabId: action.tabId });
      case BrowserOperation.Navigate:
        yield* navigateBrowserPage({ connection, page, url: action.url });

        break;
      case BrowserOperation.Click:
      case BrowserOperation.Type:
      case BrowserOperation.Scroll:
      case BrowserOperation.Key:
        yield* performBrowserInput({ connection, page, action });

        break;
      case BrowserOperation.Observe: {
        const observation = yield* observeBrowserPage({ connection, page });
        const tab = yield* readBrowserTab({ connection, tabId: action.tabId });

        const preview = yield* captureBrowserPreview({ connection, sessionId: page.sessionId });

        return BrowserResult.cases.Observation.make({ tab, ...observation, preview });
      }

      case BrowserOperation.Screenshot: {
        const observation = yield* observeBrowserPage({ connection, page });
        const tab = yield* readBrowserTab({ connection, tabId: action.tabId });

        const artifactId = EvidenceArtifactId.make(request.requestId);

        const screenshot = yield* captureBrowserScreenshot({
          settings,
          artifactId,
          connection,
          sessionId: page.sessionId,
          tab,
          repositoryPath: action.repositoryPath,
          children,
        });

        return BrowserResult.cases.Screenshot.make({ tab, observationId: observation.observationId, ...screenshot });
      }
      case BrowserOperation.Console:
      case BrowserOperation.Network: {
        const tab = yield* readBrowserTab({ connection, tabId: action.tabId });
        const buffer = page.console;
        const selected = { buffer };

        if (action._tag === BrowserOperation.Network) {
          selected.buffer = page.network;
        }

        const reading = selected.buffer.read();

        return BrowserResult.cases.Logs.make({ tab, ...reading });
      }
      case BrowserOperation.RecordStart: {
        if (Option.isSome(state.recording) && !Deferred.isDoneUnsafe(state.recording.value.settled)) {
          return yield* new BrowserFailed({
            kind: BrowserFailureKind.Conflict,
            reason: 'a browser recording is already active',
          });
        }

        const tab = yield* readBrowserTab({ connection, tabId: action.tabId });

        const recordingId = EvidenceArtifactId.make(request.requestId);

        const recording = yield* startBrowserRecording({
          settings,
          repositoryPath: action.repositoryPath,
          session: chromium,
          page,
          tab,
          recordingId,
        });

        state.recording = Option.some(recording);

        const stopWhenAdmitted = Effect.fn('stopWhenAdmitted')(function* (): Effect.fn.Return<
          boolean,
          never,
          Scope.Scope
        > {
          const admission = Effect.callback<boolean>((resume) => {
            const isAdmitted = settings.activity.admit();
            const result = Result.succeed(isAdmitted);
            const admitted = Effect.fromResult(result);

            resume(admitted);
          });

          const release: (isAdmitted: boolean) => Effect.Effect<void> = (isAdmitted) => {
            if (isAdmitted) {
              state.isFinalizingRecording = false;

              settings.activity.finish();
            }

            const result = Result.succeed(undefined);

            return Effect.fromResult(result);
          };

          const isAdmitted = yield* Effect.acquireRelease(admission, release);

          if (!isAdmitted) {
            return false;
          }

          state.isFinalizingRecording = true;

          const failed: (failure: BrowserError) => Effect.Effect<boolean> = (failure) =>
            Deferred.fail(recording.settled, failure);

          yield* stopBrowserRecording({ settings, session: chromium, children, recording }).pipe(
            Effect.catchTags({ BrowserFailed: failed, BrowserUncertain: failed }),
          );

          return true;
        }, Effect.scoped);

        const stopAtDeadline = Effect.fn('stopAtDeadline')(function* (): Effect.fn.Return<void> {
          yield* Effect.sleep(BROWSER_RECORDING_MAX_DURATION);

          while (!Deferred.isDoneUnsafe(recording.settled)) {
            const didFinish = yield* stopWhenAdmitted();

            if (didFinish) {
              return;
            }

            yield* Effect.sleep(CHECKPOINT_RETRY_DELAY);
          }
        });

        const deadline = stopAtDeadline();

        yield* FiberSet.run(fibers, deadline);

        return BrowserResult.cases.Recording.make({
          tab,
          recordingId: recording.recordingId,
          maximumDuration: BROWSER_RECORDING_MAX_DURATION,
        });
      }
      case BrowserOperation.RecordStop: {
        const recording = state.recording;

        if (
          Option.isNone(recording) ||
          recording.value.tab.tabId !== action.tabId ||
          recording.value.recordingId !== action.recordingId
        ) {
          return yield* new BrowserFailed({
            kind: BrowserFailureKind.Conflict,
            reason: 'this browser tab has no recording in the current runtime',
          });
        }

        const artifact = yield* stopBrowserRecording({
          settings,
          session: chromium,
          children,
          recording: recording.value,
        });

        return BrowserResult.cases.Video.make({ tab: recording.value.tab, artifact });
      }
    }

    const tab = yield* readBrowserTab({ connection, tabId: action.tabId });

    return BrowserResult.cases.Tab.make({ tab });
  });

  const performAction = Effect.fn('performAction')(function* (
    input: BrowserActionInput,
  ): Effect.fn.Return<BrowserResult, BrowserError> {
    const session = yield* ensureSession();

    yield* session.pages.checkDiagnostics();

    const result = yield* runAction({ ...input, session });

    yield* session.pages.checkDiagnostics();

    return result;
  });

  const execute = Effect.fn('execute')(function* ({
    request,
  }: BrowserRequestInput): Effect.fn.Return<BrowserResponse, BrowserFailed> {
    const saved = yield* readBrowserReceipt({ scratchDirectory: settings.scratchDirectory, request });

    if (Option.isSome(saved)) {
      return saved.value;
    }

    const noResponse = Option.none();

    yield* writeBrowserReceipt({ scratchDirectory: settings.scratchDirectory, request, response: noResponse });

    const mutation = { isAcknowledged: false };

    const acknowledge: BrowserActionInput['acknowledge'] = () => {
      mutation.isAcknowledged = true;
    };

    const failed: (failure: BrowserError) => Effect.Effect<BrowserResult> = (failure) => {
      const reason = failure.reason.slice(0, BROWSER_TEXT_MAX_CHARS);

      if (failure._tag === BrowserFailureTag.Uncertain || mutation.isAcknowledged) {
        const result = BrowserResult.cases.Uncertain.make({ reason });
        const completed = Result.succeed(result);

        return Effect.fromResult(completed);
      }

      const result = BrowserResult.cases.Failed.make({ reason });
      const completed = Result.succeed(result);

      return Effect.fromResult(completed);
    };

    const result = yield* performAction({ request, acknowledge }).pipe(
      Effect.catchTags({ BrowserFailed: failed, BrowserUncertain: failed }),
    );

    const response = boundBrowserResponse({ response: { requestId: request.requestId, result } });

    const ready = Option.some(response);

    yield* writeBrowserReceipt({ scratchDirectory: settings.scratchDirectory, request, response: ready });

    return response;
  });

  const perform: BrowserRuntime['perform'] = Effect.fn('perform')(function* ({
    request,
  }): Effect.fn.Return<BrowserResponse, BrowserFailed> {
    const fingerprint = Schema.encodeSync(BrowserRequestJson)(request);
    const present = pending.get(request.requestId);
    const known = Option.fromNullishOr(present);

    if (Option.isSome(known)) {
      if (known.value.fingerprint !== fingerprint) {
        return yield* new BrowserFailed({
          kind: BrowserFailureKind.Conflict,
          reason: 'pending browser request identifier was reused for another action',
        });
      }

      return yield* Deferred.await(known.value.settled);
    }

    if (pending.size >= BROWSER_PENDING_REQUESTS) {
      return yield* new BrowserFailed({ kind: BrowserFailureKind.Capacity, reason: 'browser request queue is full' });
    }

    const settled = Deferred.makeUnsafe<BrowserResponse, BrowserFailed>();

    pending.set(request.requestId, { request, fingerprint, settled });

    const complete = Effect.fn('complete')(function* (): Effect.fn.Return<void> {
      const execution = execute({ request }).pipe(Semaphore.withPermits(semaphore, 1));

      yield* Deferred.complete(settled, execution);

      pending.delete(request.requestId);
    });

    const completing = complete();

    yield* FiberSet.run(fibers, completing);

    return yield* Deferred.await(settled);
  });

  function pendingReceipt({
    requestId,
  }: BrowserRequestIdentity): Option.Option<typeof BrowserReceipt.cases.Pending.Type> {
    const current = pending.get(requestId);
    const found = Option.fromNullishOr(current);

    if (Option.isNone(found) || Deferred.isDoneUnsafe(found.value.settled)) {
      return Option.none();
    }

    const receipt = BrowserReceipt.cases.Pending.make({ request: found.value.request });

    return Option.some(receipt);
  }

  const readReceipt: BrowserRuntime['readReceipt'] = Effect.fn('readReceipt')(function* ({
    requestId,
  }): Effect.fn.Return<BrowserReceipt, BrowserFailed> {
    const initial = pendingReceipt({ requestId });

    if (Option.isSome(initial)) {
      return initial.value;
    }

    const saved = yield* readBrowserReceiptRecord({ scratchDirectory: settings.scratchDirectory, requestId });

    if (Option.isSome(saved) && Option.isSome(saved.value.response)) {
      return BrowserReceipt.cases.Ready.make({ request: saved.value.request, response: saved.value.response.value });
    }

    const current = pendingReceipt({ requestId });

    if (Option.isSome(current)) {
      return current.value;
    }

    if (Option.isNone(saved)) {
      return BrowserReceipt.cases.Missing.make({ requestId });
    }

    return BrowserReceipt.cases.Uncertain.make({
      request: saved.value.request,
      reason: 'browser action has no saved result or live execution; it will not be replayed',
    });
  });

  const readArtifactPart: BrowserRuntime['readArtifactPart'] = (request) =>
    readBrowserArtifactPart({ settings, ...request });

  const ownedProcessGroups: BrowserRuntime['ownedProcessGroups'] = () =>
    children.all().map((running) => running.groupId);

  const isBusy: BrowserRuntime['isBusy'] = () => {
    const requests = pending.values();
    const inflight = Array.from(requests);

    return state.isFinalizingRecording || inflight.some((request) => !Deferred.isDoneUnsafe(request.settled));
  };

  return { perform, readReceipt, readArtifactPart, ownedProcessGroups, isBusy };
});
