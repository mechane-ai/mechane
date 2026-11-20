import { captureOptionalSnapshot, SandboxProviderError, sandboxWorkerEnvironment } from '@mechane/sandbox-provider';
import type {
  SandboxHandle,
  SandboxIdentifierInput,
  SandboxLeaseSpecification,
  SandboxProviderAdapter,
  SandboxSnapshot,
  SandboxStopInput,
  SandboxStopResult,
} from '@mechane/sandbox-provider';
import { DateTime, Record } from 'effect';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const DEFAULT_COMMAND_TIMEOUT_MS = 60_000;
const HTTP_INTERNAL_ERROR = 500;
const SANDBOX_ID_MAX_LENGTH = 64;

type DockerSandboxConfiguration = {
  readonly dockerExecutable?: string | undefined;
  readonly network?: string | undefined;
  readonly entrypointCommand?: ReadonlyArray<string> | undefined;
};

type DockerCommandInput = { readonly commandArguments: ReadonlyArray<string>; readonly timeoutMs?: number | undefined };

function safeIdentifier(value: string): string {
  return value.replaceAll(/[^A-Za-z0-9_.-]/gu, '-').slice(0, SANDBOX_ID_MAX_LENGTH);
}

function containerName(sessionId: string): string {
  return `mechane-sbx-${safeIdentifier(sessionId)}`;
}

function volumeName(sessionId: string): string {
  return `mechane-ws-${safeIdentifier(sessionId)}`;
}

/** Creates a local Docker `SandboxProviderAdapter` for fast dev and CI without a second `celld` host. */
export function createDockerSandboxProvider({
  dockerExecutable = 'docker',
  network,
  entrypointCommand = [],
}: DockerSandboxConfiguration = {}): SandboxProviderAdapter {
  async function runDocker({
    commandArguments,
    timeoutMs = DEFAULT_COMMAND_TIMEOUT_MS,
  }: DockerCommandInput): Promise<string> {
    try {
      const { stdout } = await execFileAsync(dockerExecutable, [...commandArguments], {
        encoding: 'utf8',
        timeout: timeoutMs,
      });

      return stdout.trim();
    } catch (cause) {
      throw new SandboxProviderError({
        provider: 'docker',
        status: HTTP_INTERNAL_ERROR,
        isRetryable: false,
        reason: `Docker command failed (${commandArguments[0] ?? 'unknown'}): ${String(cause)}`,
      });
    }
  }

  async function inspectStatus(sandboxId: string): Promise<'running' | 'stopped' | 'missing'> {
    try {
      const state = await runDocker({ commandArguments: ['inspect', '--format', '{{.State.Running}}', sandboxId] });

      if (state === 'true') {
        return 'running';
      }

      return 'stopped';
    } catch {
      return 'missing';
    }
  }

  async function startOrResume(specification: SandboxLeaseSpecification): Promise<SandboxHandle> {
    const targetId = specification.existingSandboxId ?? containerName(specification.sessionId);
    const currentState = await inspectStatus(targetId);

    if (currentState === 'running') {
      return { provider: 'docker', sandboxId: targetId, status: 'running' };
    }

    if (currentState === 'stopped') {
      await runDocker({ commandArguments: ['rm', '-f', targetId] });
    }

    const environment = sandboxWorkerEnvironment(specification);
    const environmentArguments = Record.toEntries(environment).flatMap(([key, value]) => ['--env', `${key}=${value}`]);
    const image = specification.snapshotId ?? specification.image;

    const commandArguments: Array<string> = [
      'run',
      '--detach',
      '--name',
      targetId,
      '--label',
      'io.mechane.sandbox=docker',
      '--label',
      `io.mechane.session=${specification.sessionId}`,
      '--mount',
      `type=volume,source=${volumeName(specification.sessionId)},target=/workspace`,
      ...environmentArguments,
    ];

    if (network !== undefined) {
      commandArguments.push('--network', network);
    }

    if (specification.memoryMegabytes !== undefined) {
      commandArguments.push('--memory', `${specification.memoryMegabytes}m`);
    }

    if (specification.cpuCores !== undefined) {
      commandArguments.push('--cpus', String(specification.cpuCores));
    }

    commandArguments.push(image, ...entrypointCommand);

    await runDocker({ commandArguments });

    return { provider: 'docker', sandboxId: targetId, status: 'running' };
  }

  async function snapshot({ sandboxId }: SandboxIdentifierInput): Promise<SandboxSnapshot> {
    const now = DateTime.nowUnsafe();
    const tag = `mechane-snap:${safeIdentifier(sandboxId)}-${DateTime.toEpochMillis(now)}`;

    await runDocker({ commandArguments: ['commit', sandboxId, tag] });

    return { snapshotId: tag, createdAt: DateTime.formatIso(now) };
  }

  async function status({ sandboxId }: SandboxIdentifierInput): Promise<SandboxHandle> {
    const current = await inspectStatus(sandboxId);

    if (current === 'running') {
      return { provider: 'docker', sandboxId, status: 'running' };
    }

    return { provider: 'docker', sandboxId, status: 'stopped' };
  }

  async function stop({ sandboxId, shouldSnapshot = false }: SandboxStopInput): Promise<SandboxStopResult> {
    const current = await inspectStatus(sandboxId);

    if (current === 'missing') {
      return { snapshotId: null };
    }

    const snapshotId = await captureOptionalSnapshot({ sandboxId, shouldSnapshot, snapshot });

    if (current === 'running') {
      await runDocker({ commandArguments: ['stop', '--time', '10', sandboxId] });
    }

    return { snapshotId };
  }

  async function destroy({ sandboxId }: SandboxIdentifierInput): Promise<void> {
    const current = await inspectStatus(sandboxId);

    if (current !== 'missing') {
      await runDocker({ commandArguments: ['rm', '-f', sandboxId] });
    }
  }

  return { kind: 'docker', startOrResume, snapshot, status, stop, destroy };
}
