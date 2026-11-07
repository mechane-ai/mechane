import { BrowserMediaType } from '@mechane/sandbox-wire';

/** Durable action intents and terminal responses live together under this private folder. */
export const REQUESTS_DIRECTORY = 'requests';

/** Immutable capture bytes and metadata remain outside the portable workspace. */
export const ARTIFACTS_DIRECTORY = 'artifacts';

/** Native recording and transcode intermediates exist only while their scope is open. */
export const RECORDINGS_DIRECTORY = 'recordings';

/** The receipt and artifact metadata encoding is JSON. */
export const METADATA_SUFFIX = '.json';

/** An incomplete write cannot be mistaken for a committed record. */
export const PARTIAL_SUFFIX = '.partial';

/** A derived preview is removed after its bytes are read. */
export const PREVIEW_SUFFIX = '.preview.jpg';

/** Media suffixes are chosen by the capture's declared format. */
export const ARTIFACT_SUFFIX = {
  [BrowserMediaType.Png]: '.png',
  [BrowserMediaType.Jpeg]: '.jpg',
  [BrowserMediaType.Mp4]: '.mp4',
} as const;

/** Chromium's recording stream and its shareable transcode are distinct intermediates. */
export const RECORDING_FILE = { Native: 'native.mp4', Video: 'video.mp4' } as const;
