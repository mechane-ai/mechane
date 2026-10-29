/** The current condition supported by the latest observation, including missing evidence. */
export const FindingState = { Open: 'open', Recovered: 'recovered', Unknown: 'unknown' } as const;

export type FindingState = (typeof FindingState)[keyof typeof FindingState];

/** The material transition recorded for the current finding revision. */
export const FindingChange = {
  Appeared: 'appeared',
  Changed: 'changed',
  Recovered: 'recovered',
  Unknown: 'unknown',
} as const;

export type FindingChange = (typeof FindingChange)[keyof typeof FindingChange];

/** The maximum number of distinct finding identities a watch can retain. */
export const FINDINGS_PER_WATCH = 256;
/** The admission limit for a stable finding key. */
export const FINDING_KEY_MAX_CHARS = 160;
/** The admission limit for one finding summary. */
export const FINDING_SUMMARY_MAX_CHARS = 4000;
/** The admission limit for a signature of the observed condition. */
export const FINDING_FINGERPRINT_MAX_CHARS = 256;
/** The admission limit for source links in one observation. */
export const FINDING_EVIDENCE_MAX_LINKS = 16;
/** The admission limit for one supporting source URL. */
export const FINDING_EVIDENCE_URL_MAX_CHARS = 2048;
