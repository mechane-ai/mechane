import { SandboxPhase, SandboxReport } from '@mechane/protocol';
import { randomUUID } from 'node:crypto';
import { runCli } from '../cli/run-cli.ts';
import type { MechContext } from '../types.ts';
import { waitFor } from '../wait-for.ts';

const UPGRADE_TERMINAL_PHASES: ReadonlySet<SandboxPhase> = new Set([SandboxPhase.Done, SandboxPhase.Failed]);

export async function upgradeSandbox(input: MechContext): Promise<void> {
  const operationId = randomUUID();

  const report = await waitFor({
    name: 'the authorized sandbox upgrade to finish',
    read: () =>
      runCli({
        ...input,
        args: [
          'sandbox',
          'upgrade',
          input.mechId,
          '--workspace',
          input.account.workspaceId,
          '--operation-id',
          operationId,
        ],
        schema: SandboxReport,
      }),
    accept: (result) => UPGRADE_TERMINAL_PHASES.has(result.phase),
  });

  if (report.phase !== SandboxPhase.Done) {
    throw new Error('The authorized sandbox upgrade failed');
  }
}
