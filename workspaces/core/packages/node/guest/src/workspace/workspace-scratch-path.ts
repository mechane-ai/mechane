import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const WORKSPACE_SCRATCH_PREFIX = 'mechane-workspace-';

/** The prefix for scratch storage outside the home included in each checkpoint. */
export function workspaceScratchPath(): string {
  const temporary = tmpdir();

  return join(temporary, WORKSPACE_SCRATCH_PREFIX);
}
