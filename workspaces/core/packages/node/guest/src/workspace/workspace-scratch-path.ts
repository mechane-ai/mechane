import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** The prefix for scratch storage outside the home included in each checkpoint. */
export function workspaceScratchPath(): string {
  const temporary = tmpdir();

  return join(temporary, 'mechane-workspace-');
}
