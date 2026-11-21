import { RecordId } from '@mechane/records';
import type { WorkspaceId } from '@mechane/records';
import { Option, Schema } from 'effect';

type Selection = { readonly workspaceId: typeof WorkspaceId.Encoded };
type WorkspaceHeader = { readonly value: string };

const MANAGED_WORKSPACE_PATTERN = /^wrkspc_([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/iu;

const isRecordId = Schema.is(RecordId);

/** Public workspace identifier for the owning installation or a private Console workspace. */
export function managedWorkspaceId({ workspaceId }: Selection): string {
  return `wrkspc_${workspaceId.toLowerCase().replaceAll('-', '')}`;
}

/** Parses either `wrkspc_<32hex>` or a canonical lowercase UUID workspace header into its workspace RecordId. */
export function parseManagedWorkspaceId({ value }: WorkspaceHeader): Option.Option<RecordId> {
  const execution = MANAGED_WORKSPACE_PATTERN.exec(value);
  const matched = Option.fromNullishOr(execution);

  if (Option.isSome(matched)) {
    const [, partOne, partTwo, partThree, partFour, partFive] = matched.value;
    const formatted = `${partOne}-${partTwo}-${partThree}-${partFour}-${partFive}`.toLowerCase();

    if (isRecordId(formatted)) {
      return Option.some(formatted);
    }

    return Option.none();
  }

  if (isRecordId(value)) {
    return Option.some(value);
  }

  return Option.none();
}
