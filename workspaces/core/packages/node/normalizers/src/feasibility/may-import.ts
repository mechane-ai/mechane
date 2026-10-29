import { ENTRY_FILE, fileRole, RoleFile } from '@mechane/modules';
import { Option, Record } from 'effect';
import { basename } from 'node:path';

/** The role of an importing file, and the file it would import. */
type MayImportInput = {
  /** Absent for a behavior file, an entry or an executable, which may import any file. */
  readonly role: Option.Option<RoleFile>;
  readonly file: string;
};

/**
 * Whether a file of `role` may import `file` (ST-34). A behavior file imports any file. A role file imports an entry or
 * a role file of its own role or an earlier one, never a behavior file.
 */
export function mayImport({ role, file }: MayImportInput): boolean {
  if (Option.isNone(role)) {
    return true;
  }

  const order = Record.values(RoleFile);
  const importerOrder = order.indexOf(role.value);
  const fileOrder = Option.map(fileRole({ path: file }), (own) => order.indexOf(own));

  return basename(file) === ENTRY_FILE || Option.exists(fileOrder, (position) => position <= importerOrder);
}
