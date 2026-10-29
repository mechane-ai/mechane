import type { RecordsInput } from '@mechane/store';
import type { BindRemoteSandboxInput } from '../types.ts';

type BindSandboxInput = RecordsInput & BindRemoteSandboxInput;

/** Retains the first VM identity so a missing provider machine cannot silently replace its files. */
export function bindRemoteSandbox({ sql, sandboxId }: BindSandboxInput): void {
  sql.exec('INSERT INTO remote_sandbox (slot, id) VALUES (1, ?) ON CONFLICT (slot) DO NOTHING', sandboxId);
}
