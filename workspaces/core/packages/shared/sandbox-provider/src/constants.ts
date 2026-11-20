/** Header names for direct worker-to-R2 session evidence uploads. */
export const SANDBOX_EVIDENCE_HEADERS = {
  kind: 'x-mechane-evidence-kind',
  sha256: 'x-mechane-evidence-sha256',
  turnId: 'x-mechane-evidence-turn-id',
  width: 'x-mechane-evidence-width',
  height: 'x-mechane-evidence-height',
  durationMs: 'x-mechane-evidence-duration-ms',
} as const;
