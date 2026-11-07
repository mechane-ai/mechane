import {
  BrowserTabId,
  Bytes,
  EvidenceArtifactId,
  EvidenceProvenance,
  RecordId,
  Sequence,
  SHA256_PATTERN,
} from '@mechane/records';
import { Schema } from 'effect';
import {
  BROWSER_ARTIFACT_PART_BYTES,
  BROWSER_COORDINATE_MAX_PIXELS,
  BROWSER_INPUT_MAX_CHARS,
  BROWSER_INPUT_TAB_ID_MAX_CHARS,
  BROWSER_MAX_LOGS,
  BROWSER_MAX_TARGETS,
  BROWSER_NAVIGATION_URL_PATTERN,
  BROWSER_PREVIEW_MAX_BYTES,
  BROWSER_TEXT_MAX_CHARS,
  BROWSER_URL_MAX_CHARS,
  BrowserKey,
  BrowserMediaType,
} from './constants.ts';

const BASE64_INPUT_BYTES = 3;
const BASE64_OUTPUT_CHARS = 4;

const BrowserText = Schema.String.check(Schema.isMaxLength(BROWSER_TEXT_MAX_CHARS));
const BrowserUrl = Schema.String.check(Schema.isMaxLength(BROWSER_URL_MAX_CHARS));
const BrowserNavigationUrl = BrowserUrl.check(Schema.isPattern(BROWSER_NAVIGATION_URL_PATTERN));
/** Identifies one replay-safe browser action receipt within its owning guest. */
export const BrowserRequestId = RecordId.pipe(Schema.brand('BrowserRequestId'));
export type BrowserRequestId = typeof BrowserRequestId.Type;
/** Identifies a transient target set that becomes invalid after page or viewport changes. */
export const BrowserObservationId = RecordId.pipe(Schema.brand('BrowserObservationId'));
export type BrowserObservationId = typeof BrowserObservationId.Type;
const BrowserInputTabId = BrowserTabId.check(Schema.isMaxLength(BROWSER_INPUT_TAB_ID_MAX_CHARS));
const BrowserCoordinate = Schema.Number.check(Schema.isBetween({ minimum: 0, maximum: BROWSER_COORDINATE_MAX_PIXELS }));

const BrowserScrollDelta = Schema.Number.check(
  Schema.isBetween({ minimum: -BROWSER_COORDINATE_MAX_PIXELS, maximum: BROWSER_COORDINATE_MAX_PIXELS }),
);

/** Requires both semantic and coordinate clicks to name the observation that justified them. */
export const BrowserClickTarget = Schema.TaggedUnion({
  Element: { observationId: BrowserObservationId, reference: BrowserText },
  Point: { observationId: BrowserObservationId, positionX: BrowserCoordinate, positionY: BrowserCoordinate },
});

export type BrowserClickTarget = typeof BrowserClickTarget.Type;

/** Decodes explicit bounded browser operations without page-script evaluation or invented selectors. */
export const BrowserAction = Schema.TaggedUnion({
  Tabs: {},
  Open: { url: BrowserNavigationUrl },
  Close: { tabId: BrowserInputTabId },
  Navigate: { tabId: BrowserInputTabId, url: BrowserNavigationUrl },
  Observe: { tabId: BrowserInputTabId },
  Click: { tabId: BrowserInputTabId, target: BrowserClickTarget },
  Type: { tabId: BrowserInputTabId, text: Schema.String.check(Schema.isMaxLength(BROWSER_INPUT_MAX_CHARS)) },
  Scroll: {
    tabId: BrowserInputTabId,
    positionX: BrowserCoordinate,
    positionY: BrowserCoordinate,
    deltaX: BrowserScrollDelta,
    deltaY: BrowserScrollDelta,
  },
  Key: { tabId: BrowserInputTabId, key: Schema.Enum(BrowserKey) },
  Screenshot: {
    tabId: BrowserInputTabId,
    /** Absent when no checkout was selected; capture provenance remains unknown. */
    repositoryPath: Schema.OptionFromOptionalKey(BrowserText),
  },
  RecordStart: {
    tabId: BrowserInputTabId,
    /** Absent when no checkout was selected; recording provenance remains unknown. */
    repositoryPath: Schema.OptionFromOptionalKey(BrowserText),
  },
  RecordStop: { tabId: BrowserInputTabId, recordingId: EvidenceArtifactId },
  Console: { tabId: BrowserInputTabId },
  Network: { tabId: BrowserInputTabId },
});

export type BrowserAction = typeof BrowserAction.Type;

/** Pairs one immutable action with its identity so retries can join or replay safely. */
export const BrowserRequest = Schema.Struct({ requestId: BrowserRequestId, action: BrowserAction });
export type BrowserRequest = typeof BrowserRequest.Type;

/** Describes the CSS-pixel geometry shared by observations, screenshots, and input. */
const BrowserViewport = Schema.Struct({ width: Schema.Int, height: Schema.Int, deviceScaleFactor: Schema.Number });

/** Reports a live Chromium page identity with display metadata and its current viewport. */
export const BrowserTab = Schema.Struct({
  tabId: BrowserTabId,
  url: BrowserUrl,
  title: BrowserText,
  viewport: BrowserViewport,
});

export type BrowserTab = typeof BrowserTab.Type;

/** Exposes only text and references observed from Chromium’s accessibility tree. */
export const BrowserTarget = Schema.Struct({
  reference: BrowserText,
  role: BrowserText,
  name: BrowserText,
  value: BrowserText,
});

export type BrowserTarget = typeof BrowserTarget.Type;

/** Describes immutable capture bytes with actual capture time, media duration, digest, and checkout provenance. */
export const BrowserArtifact = Schema.Struct({
  artifactId: EvidenceArtifactId,
  capturedAt: Schema.DateTimeUtcFromString,
  provenance: EvidenceProvenance,
  path: BrowserText,
  mediaType: Schema.Enum(BrowserMediaType),
  sizeBytes: Bytes,
  sha256: Schema.String.check(Schema.isPattern(SHA256_PATTERN)),
  widthPixels: Schema.Int,
  heightPixels: Schema.Int,
  duration: Schema.DurationFromMillis,
  tabId: BrowserTabId,
  url: BrowserUrl,
});

export type BrowserArtifact = typeof BrowserArtifact.Type;

/** Carries a bounded transient JPEG suitable for inline model observation. */
export const BrowserPreview = Schema.Struct({
  mediaType: Schema.Literal(BrowserMediaType.Jpeg),
  base64: Schema.String.check(Schema.isMaxLength(BROWSER_PREVIEW_MAX_BYTES)),
  width: Schema.Int,
  height: Schema.Int,
});

export type BrowserPreview = typeof BrowserPreview.Type;

/** Records a bounded diagnostic entry with a sequence that survives tail truncation. */
export const BrowserLog = Schema.Struct({ sequence: Sequence, kind: BrowserText, text: BrowserText });
export type BrowserLog = typeof BrowserLog.Type;

/** Distinguishes successful results, known failures, and uncertain effects that must not be replayed blindly. */
export const BrowserResult = Schema.TaggedUnion({
  Tabs: { tabs: Schema.Array(BrowserTab) },
  Tab: { tab: BrowserTab },
  Closed: { tabId: BrowserTabId },
  Observation: {
    tab: BrowserTab,
    observationId: BrowserObservationId,
    targets: Schema.Array(BrowserTarget).check(Schema.isMaxLength(BROWSER_MAX_TARGETS)),
    isTruncated: Schema.Boolean,
    preview: BrowserPreview,
  },
  Screenshot: {
    tab: BrowserTab,
    observationId: BrowserObservationId,
    artifact: BrowserArtifact,
    preview: BrowserPreview,
  },
  Recording: { tab: BrowserTab, recordingId: EvidenceArtifactId, maximumDuration: Schema.DurationFromMillis },
  Video: { tab: BrowserTab, artifact: BrowserArtifact },
  Logs: {
    tab: BrowserTab,
    entries: Schema.Array(BrowserLog).check(Schema.isMaxLength(BROWSER_MAX_LOGS)),
    omittedEntries: Schema.Int,
  },
  Uncertain: { reason: BrowserText },
  Failed: { reason: BrowserText },
});

export type BrowserResult = typeof BrowserResult.Type;

/** Carries the terminal result saved under the exact browser request identity. */
export const BrowserResponse = Schema.Struct({ requestId: BrowserRequestId, result: BrowserResult });
export type BrowserResponse = typeof BrowserResponse.Type;

/** Reports only existing guest state and preserves the original action for transport reconciliation. */
export const BrowserReceipt = Schema.TaggedUnion({
  Missing: { requestId: BrowserRequestId },
  Pending: { request: BrowserRequest },
  Ready: { request: BrowserRequest, response: BrowserResponse },
  Uncertain: { request: BrowserRequest, reason: BrowserText },
});

export type BrowserReceipt = typeof BrowserReceipt.Type;

/** Selects a byte offset within one capture without accepting a caller-supplied path. */
export const BrowserArtifactPartRequest = Schema.Struct({
  artifactId: EvidenceArtifactId,
  offset: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export type BrowserArtifactPartRequest = typeof BrowserArtifactPartRequest.Type;

/** Carries a bounded chunk plus immutable capture metadata for end-to-end digest verification. */
export const BrowserArtifactPart = Schema.Struct({
  artifact: BrowserArtifact,
  offset: Schema.Int,
  base64: Schema.String.check(
    Schema.isMaxLength(Math.ceil(BROWSER_ARTIFACT_PART_BYTES / BASE64_INPUT_BYTES) * BASE64_OUTPUT_CHARS),
  ),
  isLast: Schema.Boolean,
});

export type BrowserArtifactPart = typeof BrowserArtifactPart.Type;
