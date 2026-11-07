import type { EvidenceProvenance } from '@mechane/records';
import {
  BROWSER_ARTIFACT_PART_BYTES,
  BROWSER_VIEWPORT_HEIGHT,
  BROWSER_VIEWPORT_WIDTH,
  BrowserMediaType,
} from '@mechane/sandbox-wire';
import type { BrowserArtifact, BrowserTab } from '@mechane/sandbox-wire';
import { DateTime, Deferred, Effect, Option } from 'effect';
import type { Scope } from 'effect';
import type { BrowserPage } from './browser-pages.ts';
import type { BrowserChildren } from './browser-process.ts';
import { readBrowserProvenance } from './browser-provenance.ts';
import type { ChromiumSession } from './chromium.ts';
import { EmptyReply, RecordingReply, StreamReply } from './devtools.schemas.ts';
import { devtoolsCommand } from './devtools.ts';
import type { BrowserError } from './errors.ts';
import { saveBrowserArtifact } from './store/browser-artifacts.ts';
import { openBrowserRecordingFiles } from './store/recording-files.ts';
import type { BrowserSettings } from './types.ts';

const RECORDING_FRAME_RATE = 15;

/** Owns one native recording and its shared terminal receipt so concurrent stops join the same capture. */
export type BrowserRecording = {
  readonly recordingId: BrowserArtifact['artifactId'];
  readonly tab: BrowserTab;
  readonly page: BrowserPage;
  readonly capturedAt: DateTime.Utc;
  readonly provenance: EvidenceProvenance;
  readonly settled: Deferred.Deferred<BrowserArtifact, BrowserError>;
  readonly claimStop: () => boolean;
};

type StartBrowserRecordingInput = {
  readonly settings: BrowserSettings;
  /** Absent when the capture has no explicitly selected checkout; provenance then remains unknown. */
  readonly repositoryPath: Option.Option<string>;
  readonly session: ChromiumSession;
  readonly page: BrowserPage;
  readonly tab: BrowserTab;
  readonly recordingId: BrowserArtifact['artifactId'];
};

/** Begins native page recording with checkout provenance sampled before capture. */
export const startBrowserRecording = Effect.fn('startBrowserRecording')(function* ({
  settings,
  repositoryPath,
  session,
  page,
  tab,
  recordingId,
}: StartBrowserRecordingInput): Effect.fn.Return<BrowserRecording, BrowserError> {
  const provenance = yield* readBrowserProvenance({ home: settings.home, path: settings.path, repositoryPath });

  const sessionId = Option.some(page.sessionId);

  yield* devtoolsCommand({
    connection: session.connection,
    sessionId,
    method: 'Page.startScreenRecording',
    params: {
      audio: false,
      maxWidth: BROWSER_VIEWPORT_WIDTH,
      maxHeight: BROWSER_VIEWPORT_HEIGHT,
      frameRate: RECORDING_FRAME_RATE,
      captureArea: 'target',
    },
    schema: RecordingReply,
  });

  const capturedAt = DateTime.nowUnsafe();
  const settled = Deferred.makeUnsafe<BrowserArtifact, BrowserError>();

  const state = { isStopping: false };

  const claimStop: BrowserRecording['claimStop'] = () => {
    if (state.isStopping) {
      return false;
    }

    state.isStopping = true;

    return true;
  };

  return { recordingId, page, tab, capturedAt, provenance, settled, claimStop };
});

type StopBrowserRecordingInput = {
  readonly settings: BrowserSettings;
  readonly session: ChromiumSession;
  readonly children: BrowserChildren;
  readonly recording: BrowserRecording;
};

/** Stops and encodes a recording once; every caller joins its immutable terminal result. */
export const stopBrowserRecording = Effect.fn('stopBrowserRecording')(function* (
  input: StopBrowserRecordingInput,
): Effect.fn.Return<BrowserArtifact, BrowserError> {
  const { recording } = input;

  if (!recording.claimStop()) {
    return yield* Deferred.await(recording.settled);
  }

  const encoding = encodeBrowserRecording(input);

  yield* Deferred.complete(recording.settled, encoding);

  return yield* Deferred.await(recording.settled);
});

const encodeBrowserRecording = Effect.fn('encodeBrowserRecording')(function* ({
  settings,
  session,
  children,
  recording,
}: StopBrowserRecordingInput): Effect.fn.Return<BrowserArtifact, BrowserError, Scope.Scope> {
  const connection = session.connection;
  const sessionId = Option.some(recording.page.sessionId);

  const stopping = devtoolsCommand({
    connection,
    sessionId,
    method: 'Page.stopScreenRecording',
    params: {},
    schema: RecordingReply,
  });

  const closeStream: (stream: RecordingReply) => Effect.Effect<void> = Effect.fn('closeStream')(
    function* (stream): Effect.fn.Return<void> {
      const closing = devtoolsCommand({
        connection,
        sessionId,
        method: 'IO.close',
        params: { handle: stream.stream },
        schema: EmptyReply,
      });

      yield* closing.pipe(Effect.orDie);
    },
  );

  const stopped = yield* Effect.acquireRelease(stopping, closeStream);

  const files = yield* openBrowserRecordingFiles({
    settings,
    children,
    recordingId: recording.recordingId,
    environment: session.environment,
  });

  const state = { isFinished: false };

  while (!state.isFinished) {
    const chunk = yield* devtoolsCommand({
      connection,
      sessionId,
      method: 'IO.read',
      params: { handle: stopped.stream, size: BROWSER_ARTIFACT_PART_BYTES },
      schema: StreamReply,
    });

    const bytes = recordingChunk({ chunk });

    yield* files.appendNativeChunk({ bytes });

    state.isFinished = chunk.isFinished;
  }

  const media = yield* files.finishRecording();

  const artifact = yield* saveBrowserArtifact({
    settings,
    artifactId: recording.recordingId,
    bytes: media.bytes,
    mediaType: BrowserMediaType.Mp4,
    tab: recording.tab,
    duration: media.duration,
    capturedAt: recording.capturedAt,
    provenance: recording.provenance,
  });

  return artifact;
}, Effect.scoped);

type RecordingChunkInput = { readonly chunk: StreamReply };

function recordingChunk({ chunk }: RecordingChunkInput): Buffer {
  if (chunk.isBase64Encoded === true) {
    return Buffer.from(chunk.content, 'base64');
  }

  return Buffer.from(chunk.content, 'utf8');
}
