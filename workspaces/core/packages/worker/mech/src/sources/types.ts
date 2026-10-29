import type { MechRow, SourceTask } from '@mechane/mech-store';
import type { SandboxRpc } from '@mechane/rpc';
import type { OpenedMech } from '../types.ts';

/** Source work retains its owning mech and serialized sandbox boundary. */
export type SourceContext = { readonly mech: OpenedMech; readonly owner: MechRow; readonly sandbox: SandboxRpc };

export type SourceTaskInput = SourceContext & { readonly source: SourceTask };
