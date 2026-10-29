import type { Workspace } from '@mechane/protocol';

/** Human workspace output keeps the ID visible for explicit selection. */
export function workspaceLine({ id, name, role, dailyAllowanceMicros }: Workspace): string {
  return `${id} ${name} (${role}) ${dailyAllowanceMicros} micro-dollars a day`;
}
