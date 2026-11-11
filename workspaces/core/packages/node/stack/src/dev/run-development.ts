import { writeDevOutput } from './output.ts';
import { devFailureMessage } from './protocol.ts';
import { runDevSession } from './session.ts';
import { devSettings } from './settings.ts';
import type { DevelopmentInput } from './types.ts';

/** Owns a retained source session and attaches commands through its private control endpoint. */
export async function runDevelopment(input: DevelopmentInput = {}): Promise<number> {
  try {
    const settings = devSettings(input);

    return await runDevSession({ settings, hooks: input });
  } catch (cause) {
    const message = devFailureMessage({ cause });

    writeDevOutput({ channel: 'stderr', text: `Dev command failed: ${message}\n` });

    return 1;
  }
}
