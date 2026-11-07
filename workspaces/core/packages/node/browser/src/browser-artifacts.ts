import {
  BROWSER_PREVIEW_MAX_BYTES,
  BROWSER_VIEWPORT_HEIGHT,
  BROWSER_VIEWPORT_WIDTH,
  BrowserMediaType,
} from '@mechane/sandbox-wire';
import type { BrowserArtifact, BrowserPreview, BrowserTab } from '@mechane/sandbox-wire';
import { DateTime, Duration, Effect, Option, Schema } from 'effect';
import type { BrowserChildren } from './browser-process.ts';
import { readBrowserProvenance } from './browser-provenance.ts';
import { DevtoolsCoordinates, ScreenshotReply } from './devtools.schemas.ts';
import type { DevtoolsSessionId } from './devtools.schemas.ts';
import type { DevtoolsConnection } from './devtools.ts';
import { devtoolsCommand } from './devtools.ts';
import { BrowserFailed, BrowserFailureKind } from './errors.ts';
import type { BrowserError } from './errors.ts';
import { readBrowserArtifactPreview, saveBrowserArtifact } from './store/browser-artifacts.ts';
import type { BrowserSettings } from './types.ts';

const PREVIEW_SCALE = 0.5;
const PREVIEW_QUALITY = 55;
const SCREENSHOT_ORIGIN = Schema.encodeSync(DevtoolsCoordinates)({ positionX: 0, positionY: 0 });

type ArtifactIdentity = { readonly settings: BrowserSettings; readonly artifactId: BrowserArtifact['artifactId'] };

type CaptureBrowserPreviewInput = { readonly connection: DevtoolsConnection; readonly sessionId: DevtoolsSessionId };

type CaptureBrowserScreenshotInput = ArtifactIdentity & {
  readonly connection: DevtoolsConnection;
  readonly sessionId: DevtoolsSessionId;
  readonly tab: BrowserTab;
  /** Absent when the capture has no explicitly selected checkout; provenance then remains unknown. */
  readonly repositoryPath: Option.Option<string>;
  readonly children: BrowserChildren;
};

type CapturedScreenshot = { readonly artifact: BrowserArtifact; readonly preview: BrowserPreview };

/** Captures durable PNG evidence and derives its inline preview from those same saved pixels. */
export const captureBrowserScreenshot = Effect.fn('captureBrowserScreenshot')(function* ({
  settings,
  artifactId,
  connection,
  sessionId,
  tab,
  repositoryPath,
  children,
}: CaptureBrowserScreenshotInput): Effect.fn.Return<CapturedScreenshot, BrowserError> {
  const session = Option.some(sessionId);

  const captured = yield* devtoolsCommand({
    connection,
    sessionId: session,
    method: 'Page.captureScreenshot',
    params: { format: 'png', captureBeyondViewport: false },
    schema: ScreenshotReply,
  });

  const bytes = Buffer.from(captured.base64, 'base64');
  const capturedAt = DateTime.nowUnsafe();
  const provenance = yield* readBrowserProvenance({ home: settings.home, repositoryPath, path: settings.path });

  const artifact = yield* saveBrowserArtifact({
    settings,
    artifactId,
    bytes,
    mediaType: BrowserMediaType.Png,
    tab,
    duration: Duration.zero,
    capturedAt,
    provenance,
  });

  const widthPixels = BROWSER_VIEWPORT_WIDTH * PREVIEW_SCALE;
  const heightPixels = BROWSER_VIEWPORT_HEIGHT * PREVIEW_SCALE;
  const base64 = yield* readBrowserArtifactPreview({ settings, artifactId, children, widthPixels, heightPixels });
  const preview = yield* browserPreview({ base64 });

  return { artifact, preview };
});

/** Returns a bounded, transient JPEG observation without allocating durable evidence. */
export const captureBrowserPreview = Effect.fn('captureBrowserPreview')(function* ({
  connection,
  sessionId,
}: CaptureBrowserPreviewInput): Effect.fn.Return<BrowserPreview, BrowserError> {
  const session = Option.some(sessionId);

  const preview = yield* devtoolsCommand({
    connection,
    sessionId: session,
    method: 'Page.captureScreenshot',
    params: {
      format: 'jpeg',
      quality: PREVIEW_QUALITY,
      captureBeyondViewport: false,
      clip: {
        ...SCREENSHOT_ORIGIN,
        width: BROWSER_VIEWPORT_WIDTH,
        height: BROWSER_VIEWPORT_HEIGHT,
        scale: PREVIEW_SCALE,
      },
    },
    schema: ScreenshotReply,
  });

  return yield* browserPreview({ base64: preview.base64 });
});

type BrowserPreviewInput = { readonly base64: string };

const browserPreview = Effect.fn('browserPreview')(function* ({
  base64,
}: BrowserPreviewInput): Effect.fn.Return<BrowserPreview, BrowserFailed> {
  if (Buffer.byteLength(base64, 'utf8') > BROWSER_PREVIEW_MAX_BYTES) {
    return yield* new BrowserFailed({
      kind: BrowserFailureKind.Capacity,
      reason: 'browser screenshot preview exceeds its encoded size limit',
    });
  }

  return {
    mediaType: BrowserMediaType.Jpeg,
    base64,
    width: BROWSER_VIEWPORT_WIDTH * PREVIEW_SCALE,
    height: BROWSER_VIEWPORT_HEIGHT * PREVIEW_SCALE,
  };
});
