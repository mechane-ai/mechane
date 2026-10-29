import type { DirectoryRpc } from '../directory.types.ts';
import type { BindingsInput } from '../types.ts';

/** The name of the deployment's one directory object. */
const DIRECTORY_NAME = 'directory';

/** The stub of the deployment's one directory object. */
export function directoryStub({ bindings }: BindingsInput): DurableObjectStub<DirectoryRpc> {
  return bindings.directory.get(bindings.directory.idFromName(DIRECTORY_NAME));
}
