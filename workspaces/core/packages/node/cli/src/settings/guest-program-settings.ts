import type { ProgramSettings } from '@mechane/cli-kernel';
import { PROGRAM } from '@mechane/commands';
import { Option } from 'effect';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

type GuestProgramSettingsInput = { readonly path: string };

export async function guestProgramSettings({ path }: GuestProgramSettingsInput): Promise<ProgramSettings> {
  const bytes = await readFile(path);
  const digest = createHash('sha256').update(bytes).digest('hex');
  const identity = `guest sha256:${digest}`;

  return {
    identity,
    executablePath: path,
    release: Option.none(),
    binary: Option.none(),
    userAgent: `${PROGRAM} (guest-sha256:${digest})`,
  };
}
