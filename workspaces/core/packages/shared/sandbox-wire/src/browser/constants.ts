import { Bytes, BYTES_PER_KIBIBYTE, BYTES_PER_MEBIBYTE, MediaType } from '@mechane/records';
import { Duration } from 'effect';

/** Restricts navigation to web pages and a new blank tab, excluding local-file and script URLs. */
export const BROWSER_NAVIGATION_URL_PATTERN = /^(https?:\/\/|about:blank$)/;

/** Bounds externally supplied Chromium target identities without constraining stored record text. */
export const BROWSER_INPUT_TAB_ID_MAX_CHARS = 128;
/** Bounds text inserted by one browser input action. */
export const BROWSER_INPUT_MAX_CHARS = 16_384;
/** Bounds input coordinates and scroll deltas independently of the active viewport check. */
export const BROWSER_COORDINATE_MAX_PIXELS = 16_384;

/** Fixes the browser’s CSS-pixel width so screenshots and pointer coordinates share one geometry. */
export const BROWSER_VIEWPORT_WIDTH = 1280;
/** Fixes the browser’s CSS-pixel height so observations do not depend on a host display. */
export const BROWSER_VIEWPORT_HEIGHT = 720;
/** Bounds the encoded inline image before it enters a model response. */
export const BROWSER_PREVIEW_MAX_BYTES = 512 * BYTES_PER_KIBIBYTE;
/** Caps the entire serialized receipt, including previews and multibyte accessibility labels. */
export const BROWSER_RESPONSE_MAX_BYTES = Bytes.make(BYTES_PER_MEBIBYTE);
/** Caps each private capture transfer chunk before durable evidence upload. */
export const BROWSER_ARTIFACT_PART_BYTES = Bytes.make(BYTES_PER_MEBIBYTE);
/** Bounds native recording input and the final encoded artifact independently. */
export const BROWSER_RECORDING_MAX_BYTES = 64 * BYTES_PER_MEBIBYTE;
/** Limits automatic recording and the encoded video length to the same declared span. */
export const BROWSER_RECORDING_MAX_DURATION = Duration.minutes(1);
/** Bounds the observed accessibility references returned in one model response. */
export const BROWSER_MAX_TARGETS = 100;
/** Bounds each tab’s retained console and network diagnostic tail. */
export const BROWSER_MAX_LOGS = 100;
/** Bounds explicit tab creation in one guest browser runtime. */
export const BROWSER_MAX_TABS = 16;
/** Bounds labels and diagnostics that enter browser request receipts. */
export const BROWSER_TEXT_MAX_CHARS = 2048;
/** Bounds observed and requested URLs independently of display-label limits. */
export const BROWSER_URL_MAX_CHARS = 8192;

/** Names supported key gestures without exposing arbitrary native key injection parameters. */
export const BrowserKey = {
  Enter: 'Enter',
  Tab: 'Tab',
  Escape: 'Escape',
  Backspace: 'Backspace',
  Delete: 'Delete',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Space: 'Space',
  SelectAll: 'SelectAll',
} as const;

/** Limits captures and inline previews to browser-renderable image and video formats. */
export const BrowserMediaType = { Png: MediaType.Png, Jpeg: MediaType.Jpeg, Mp4: MediaType.Mp4 } as const;

/** Names the bounded browser action vocabulary shared by the guest and harness. */
export const BrowserOperation = {
  Tabs: 'Tabs',
  Open: 'Open',
  Close: 'Close',
  Navigate: 'Navigate',
  Observe: 'Observe',
  Click: 'Click',
  Type: 'Type',
  Scroll: 'Scroll',
  Key: 'Key',
  Screenshot: 'Screenshot',
  RecordStart: 'RecordStart',
  RecordStop: 'RecordStop',
  Console: 'Console',
  Network: 'Network',
} as const;
