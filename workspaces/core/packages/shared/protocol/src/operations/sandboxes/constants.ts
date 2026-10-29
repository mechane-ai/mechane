import { BYTES_PER_KIBIBYTE } from '@mechane/records';

/** Maintenance is explicit; inspecting a sandbox never wakes it. */
export const SandboxAction = {
  Show: 'show',
  Export: 'export',
  Upgrade: 'upgrade',
  Delete: 'delete',
  Cancel: 'cancel',
  Download: 'download',
  Import: 'import',
  Upload: 'upload',
} as const;

export type SandboxAction = (typeof SandboxAction)[keyof typeof SandboxAction];

/** A bounded archive part fits comfortably in the Worker's memory and a JSON response. */
export const SANDBOX_ARCHIVE_PART_BYTES = 1024 * BYTES_PER_KIBIBYTE;

/** Maintenance holds new executions until it finishes or is canceled. */
export const SandboxPhase = {
  Idle: 'idle',
  Quiesce: 'quiesce',
  Archive: 'archive',
  Create: 'create',
  Copy: 'copy',
  Restore: 'restore',
  Commit: 'commit',
  Retire: 'retire',
  Done: 'done',
  Failed: 'failed',
} as const;

export type SandboxPhase = (typeof SandboxPhase)[keyof typeof SandboxPhase];
