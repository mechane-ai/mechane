import { BROWSER_RECORDING_MAX_BYTES, BROWSER_RECORDING_MAX_DURATION } from '@mechane/sandbox-wire';
import type { BrowserArtifact } from '@mechane/sandbox-wire';
import { Duration, Effect, Schema, SchemaTransformation } from 'effect';
import type { Scope } from 'effect';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runBrowserChild } from '../browser-process.ts';
import type { BrowserChildren } from '../browser-process.ts';
import { BrowserFailed, BrowserFailureKind } from '../errors.ts';
import type { BrowserSettings } from '../types.ts';
import { RECORDING_FILE, RECORDINGS_DIRECTORY } from './constants.ts';
import { prepareDirectory } from './prepare-directory.ts';

const ENCODING_TIMEOUT = Duration.seconds(45);
const PROBE_TIMEOUT = Duration.seconds(10);
const SecondsTransformation = SchemaTransformation.transform({ decode: Duration.seconds, encode: Duration.toSeconds });
const RecordedDuration = Schema.NumberFromString.pipe(Schema.decodeTo(Schema.Duration, SecondsTransformation));
const MediaProbe = Schema.Struct({ format: Schema.Struct({ duration: RecordedDuration }) });
const MediaProbeJson = Schema.fromJsonString(MediaProbe);

export type RecordedBrowserMedia = { readonly bytes: Uint8Array; readonly duration: Duration.Duration };
type AppendNativeChunkInput = { readonly bytes: Uint8Array };

type BrowserRecordingFiles = {
  readonly appendNativeChunk: (input: AppendNativeChunkInput) => Effect.Effect<void, BrowserFailed>;
  readonly finishRecording: () => Effect.Effect<RecordedBrowserMedia, BrowserFailed>;
};

type OpenBrowserRecordingFilesInput = {
  readonly settings: BrowserSettings;
  readonly children: BrowserChildren;
  readonly recordingId: BrowserArtifact['artifactId'];
  readonly environment: Readonly<Record<string, string>>;
};

/** Owns one recording's intermediate files, byte cap, transcode, media inspection, and scoped cleanup. */
export const openBrowserRecordingFiles = Effect.fn('openBrowserRecordingFiles')(function* ({
  settings,
  children,
  recordingId,
  environment,
}: OpenBrowserRecordingFilesInput): Effect.fn.Return<BrowserRecordingFiles, BrowserFailed, Scope.Scope> {
  const directory = join(settings.scratchDirectory, RECORDINGS_DIRECTORY);
  const temporary = join(directory, recordingId);
  const nativePath = join(temporary, RECORDING_FILE.Native);
  const videoPath = join(temporary, RECORDING_FILE.Video);

  yield* prepareDirectory({ directory });

  const opening = Effect.tryPromise({
    try: () => mkdir(temporary, { mode: 0o700 }),
    catch: (cause) => new BrowserFailed({ kind: BrowserFailureKind.Storage, reason: String(cause) }),
  });

  const removal = Effect.tryPromise({
    try: () => rm(temporary, { recursive: true, force: true }),
    catch: (cause) => new BrowserFailed({ kind: BrowserFailureKind.Storage, reason: String(cause) }),
  });

  yield* Effect.acquireRelease(opening, () => removal.pipe(Effect.orDie));
  yield* Effect.tryPromise({
    try: () => writeFile(nativePath, '', { mode: 0o600, flag: 'wx' }),
    catch: (cause) => new BrowserFailed({ kind: BrowserFailureKind.Storage, reason: String(cause) }),
  });

  const state = { sizeBytes: 0 };

  const appendNativeChunk: BrowserRecordingFiles['appendNativeChunk'] = Effect.fn('appendNativeChunk')(function* ({
    bytes,
  }): Effect.fn.Return<void, BrowserFailed> {
    if (state.sizeBytes + bytes.byteLength > BROWSER_RECORDING_MAX_BYTES) {
      return yield* new BrowserFailed({
        kind: BrowserFailureKind.Capacity,
        reason: 'browser recording exceeds its encoded byte limit',
      });
    }

    yield* Effect.tryPromise({
      try: () => writeFile(nativePath, bytes, { flag: 'a', mode: 0o600 }),
      catch: (cause) => new BrowserFailed({ kind: BrowserFailureKind.Storage, reason: String(cause) }),
    });

    state.sizeBytes += bytes.byteLength;
  });

  const finishRecording: BrowserRecordingFiles['finishRecording'] = Effect.fn('finishRecording')(
    function* (): Effect.fn.Return<RecordedBrowserMedia, BrowserFailed> {
      const recordingLimit = String(BROWSER_RECORDING_MAX_BYTES);
      const maximumSeconds = Duration.toSeconds(BROWSER_RECORDING_MAX_DURATION);
      const maximumDuration = String(maximumSeconds);

      yield* runBrowserChild({
        command: settings.encoderExecutable,
        args: [
          '-hide_banner',
          '-loglevel',
          'error',
          '-nostdin',
          '-y',
          '-i',
          nativePath,
          '-an',
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          '-movflags',
          '+faststart',
          '-fs',
          recordingLimit,
          '-t',
          maximumDuration,
          videoPath,
        ],
        environment,
        children,
        timeout: ENCODING_TIMEOUT,
      });

      const bytes = yield* Effect.tryPromise({
        try: () => readFile(videoPath),
        catch: (cause) => new BrowserFailed({ kind: BrowserFailureKind.Storage, reason: String(cause) }),
      });

      if (bytes.byteLength >= BROWSER_RECORDING_MAX_BYTES) {
        return yield* new BrowserFailed({
          kind: BrowserFailureKind.Capacity,
          reason: 'browser recording transcode reached its byte limit',
        });
      }

      const probed = yield* runBrowserChild({
        command: settings.mediaProbeExecutable,
        args: ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', videoPath],
        environment,
        children,
        timeout: PROBE_TIMEOUT,
      });

      const media = yield* Schema.decodeUnknownEffect(MediaProbeJson, { onExcessProperty: 'error' })(
        probed.stdout,
      ).pipe(
        Effect.mapError(
          () =>
            new BrowserFailed({
              kind: BrowserFailureKind.Capture,
              reason: 'browser recording media duration is unavailable',
            }),
        ),
      );

      return { bytes, duration: media.format.duration };
    },
  );

  return { appendNativeChunk, finishRecording };
});
