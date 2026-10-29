import { SandboxReport } from '@mechane/protocol';
import type { Stack } from '@mechane/stack';
import { Effect, Schema } from 'effect';
import { join } from 'node:path';
import { freshFolder } from '../fresh-folder.ts';
import type { TalkingMech } from '../mechs/types.ts';
import type { ScenarioFailure } from '../types.ts';
import { refuseBrokenImport } from './refuse-broken-import.ts';

type RoundtripWorkspaceInput = { readonly stack: Stack; readonly mech: TalkingMech };
const ExportReport = Schema.Struct({ sandbox: SandboxReport, file: Schema.String });

/** Forces subsequent file reads to come from a verified backup after the original machine and snapshot were deleted. */
export const roundtripWorkspace = Effect.fn('roundtripWorkspace')(function* ({
  stack,
  mech,
}: RoundtripWorkspaceInput): Effect.fn.Return<void, ScenarioFailure> {
  const folder = yield* freshFolder({ stack, prefix: 'workspace-roundtrip-' });
  const file = join(folder, 'home.tar.gz');

  yield* mech.command({ words: ['sandbox', 'export'], ids: ['--file', file], result: ExportReport });
  yield* mech.command({ words: ['sandbox', 'delete'], ids: ['--confirm'], result: SandboxReport });
  yield* mech.command({ words: ['sandbox', 'import'], ids: ['--file', file, '--confirm'], result: SandboxReport });
  yield* refuseBrokenImport({ stack, mech, folder });
  yield* mech.command({ words: ['sandbox', 'upgrade'], ids: [], result: SandboxReport });
});
