import { artifactDigest } from '@mechane/program';
import { Bytes } from '@mechane/records';
import { SANDBOX_TOOL_LIMITS } from '@mechane/sandbox-wire';
import type { SandboxTool, SandboxToolArchive } from '@mechane/sandbox-wire';
import { Duration, Effect, Schema } from 'effect';
import { chmod, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GuestMisconfigured } from '../errors.ts';
import { runToolCommand } from './run-tool-command.ts';

const EXECUTABLE_MODE = 0o755;
const RegularArchiveMemberPattern = Schema.isPattern(/^-[^\n]+\n?$/u);
const RegularArchiveMember = Schema.String.check(RegularArchiveMemberPattern);
const TOOL_DOWNLOAD_TIMEOUT = Duration.seconds(SANDBOX_TOOL_LIMITS.downloadSeconds);
const TOOL_COMMAND_TIMEOUT = Duration.seconds(SANDBOX_TOOL_LIMITS.commandSeconds);
const TOOL_OUTPUT_MAX_BYTES = Bytes.make(SANDBOX_TOOL_LIMITS.maxOutputBytes);
const TOOL_EXECUTABLE_MAX_BYTES = Bytes.make(SANDBOX_TOOL_LIMITS.maxExecutableBytes);

type InstallGuestToolInput = {
  readonly tool: SandboxTool;
  readonly archive: SandboxToolArchive;
  readonly folder: string;
  readonly bin: string;
  readonly environment: Readonly<Record<string, string>>;
};

/** Verifies the pinned archive and executable version before installing one tool into private machine scratch. */
export const installGuestTool = Effect.fn('installGuestTool')(function* ({
  tool,
  archive,
  folder,
  bin,
  environment,
}: InstallGuestToolInput): Effect.fn.Return<void, GuestMisconfigured> {
  const archivePath = join(folder, `${tool.name}.tar.xz`);
  const stagedPath = join(folder, `${tool.name}.pending`);
  const installedPath = join(bin, tool.name);
  const downloadSeconds = String(SANDBOX_TOOL_LIMITS.downloadSeconds);
  const maxArchiveBytes = String(SANDBOX_TOOL_LIMITS.maxArchiveBytes);
  const url = archive.url.toString();

  yield* runToolCommand({
    name: `download ${tool.name}`,
    command: '/usr/bin/curl',
    arguments: [
      '--fail',
      '--silent',
      '--show-error',
      '--proto',
      '=https',
      '--max-redirs',
      '0',
      '--max-time',
      downloadSeconds,
      '--max-filesize',
      maxArchiveBytes,
      '--output',
      archivePath,
      '--',
      url,
    ],
    environment,
    timeout: TOOL_DOWNLOAD_TIMEOUT,
    maxOutputBytes: TOOL_OUTPUT_MAX_BYTES,
  });

  const digest = yield* artifactDigest({ path: archivePath }).pipe(
    Effect.mapError(() => new GuestMisconfigured({ reason: `read ${tool.name} archive failed` })),
  );

  if (digest.sha256 !== archive.sha256) {
    return yield* new GuestMisconfigured({ reason: `${tool.name} archive checksum did not match` });
  }

  const listing = yield* runToolCommand({
    name: `inspect ${tool.name}`,
    command: '/usr/bin/tar',
    arguments: ['-tvJf', archivePath, '--', archive.executable],
    environment,
    timeout: TOOL_COMMAND_TIMEOUT,
    maxOutputBytes: TOOL_OUTPUT_MAX_BYTES,
  });

  const member = listing.toString('utf8');

  yield* Schema.decodeUnknownEffect(RegularArchiveMember, { onExcessProperty: 'error' })(member).pipe(
    Effect.mapError(() => new GuestMisconfigured({ reason: `${tool.name} archive must name one regular executable` })),
  );

  const executable = yield* runToolCommand({
    name: `extract ${tool.name}`,
    command: '/usr/bin/tar',
    arguments: ['-xJOf', archivePath, '--', archive.executable],
    environment,
    timeout: TOOL_COMMAND_TIMEOUT,
    maxOutputBytes: TOOL_EXECUTABLE_MAX_BYTES,
  });

  yield* Effect.tryPromise({
    try: (signal) => writeFile(stagedPath, executable, { flag: 'wx', signal }),
    catch: () => new GuestMisconfigured({ reason: `stage ${tool.name} executable failed` }),
  });

  yield* Effect.tryPromise({
    try: () => chmod(stagedPath, EXECUTABLE_MODE),
    catch: () => new GuestMisconfigured({ reason: `prepare ${tool.name} executable failed` }),
  });

  const output = yield* runToolCommand({
    name: `verify ${tool.name} ${tool.version}`,
    command: stagedPath,
    arguments: ['--version'],
    environment,
    timeout: TOOL_COMMAND_TIMEOUT,
    maxOutputBytes: TOOL_OUTPUT_MAX_BYTES,
  });

  const versionOutput = output.toString('utf8').trim();

  if (versionOutput !== tool.versionOutput) {
    return yield* new GuestMisconfigured({ reason: `${tool.name} executable version did not match ${tool.version}` });
  }

  yield* Effect.tryPromise({
    try: () => rename(stagedPath, installedPath),
    catch: () => new GuestMisconfigured({ reason: `install ${tool.name} executable failed` }),
  });

  yield* Effect.tryPromise({
    try: () => rm(archivePath),
    catch: () => new GuestMisconfigured({ reason: `remove ${tool.name} archive failed` }),
  });
});
