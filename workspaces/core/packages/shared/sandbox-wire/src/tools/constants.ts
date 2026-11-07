import { BYTES_PER_KIBIBYTE, BYTES_PER_MEBIBYTE } from '@mechane/records';

/** Host platforms for which an installation may pin a tool archive. */
export const SandboxToolTarget = {
  LinuxX64: 'linux-x64',
  LinuxArm64: 'linux-arm64',
  DarwinArm64: 'darwin-arm64',
} as const;

export type SandboxToolTarget = (typeof SandboxToolTarget)[keyof typeof SandboxToolTarget];

/** Manifest, transfer, and startup bounds applied before a guest accepts work. */
export const SANDBOX_TOOL_LIMITS = {
  maxEntries: 8,
  maxNameChars: 64,
  maxVersionChars: 64,
  maxVersionOutputChars: 256,
  maxUrlChars: 2048,
  maxExecutableChars: 1024,
  maxArchiveBytes: 100 * BYTES_PER_MEBIBYTE,
  maxExecutableBytes: 100 * BYTES_PER_MEBIBYTE,
  maxOutputBytes: 64 * BYTES_PER_KIBIBYTE,
  downloadSeconds: 60,
  commandSeconds: 10,
  startupSeconds: 180,
} as const;

/** Tool bootstrap accepts credential-free HTTPS archives without following redirects. */
export const SANDBOX_TOOL_PROTOCOL = 'https:';
