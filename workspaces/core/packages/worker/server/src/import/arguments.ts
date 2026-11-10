import type { ImportScopeSelection } from '@mechane/control-store';
import { RecordId, SHA256_PATTERN } from '@mechane/records';
import { Schema } from 'effect';
import { parseArgs } from 'node:util';
import { HistoryImportFailed } from './errors.ts';

export const IMPORT_USAGE =
  'Usage: import.mjs (--dry-run | --apply --expect-digest SHA256 --retirement-receipt FILE --retirement-sha256 SHA256) (--all | --workspace UUID [--mech UUID])';

const Digest = Schema.String.check(Schema.isPattern(SHA256_PATTERN));

export type ImportArguments = {
  readonly mode: 'dry-run' | 'apply' | 'help';
  readonly selection: ImportScopeSelection;
  readonly expectedDigest: string | null;
  readonly retirementReceipt: string | null;
  readonly retirementSha256: string | null;
};

type ParseImportArgumentsInput = { readonly arguments: ReadonlyArray<string> };

export function parseImportArguments({ arguments: commandLine }: ParseImportArgumentsInput): ImportArguments {
  const { values } = parseArgs({
    args: [...commandLine],
    allowPositionals: false,
    strict: true,
    options: {
      'dry-run': { type: 'boolean' },
      'apply': { type: 'boolean' },
      'all': { type: 'boolean' },
      'workspace': { type: 'string' },
      'mech': { type: 'string' },
      'expect-digest': { type: 'string' },
      'retirement-receipt': { type: 'string' },
      'retirement-sha256': { type: 'string' },
      'help': { type: 'boolean' },
    },
  });

  if (values.help === true) {
    return { mode: 'help', selection: {}, expectedDigest: null, retirementReceipt: null, retirementSha256: null };
  }

  if (values['dry-run'] === values.apply) {
    throw new HistoryImportFailed({ reason: 'Select exactly one of --dry-run or --apply' });
  }

  const selection: { workspaceId?: string; mechId?: string } = {};

  if (values.all === true) {
    if (values.workspace !== undefined || values.mech !== undefined) {
      throw new HistoryImportFailed({ reason: '--all cannot also select a workspace or mech' });
    }
  } else {
    if (values.workspace === undefined) {
      throw new HistoryImportFailed({ reason: 'Select --all or --workspace UUID' });
    }

    selection.workspaceId = Schema.decodeUnknownSync(RecordId)(values.workspace);

    if (values.mech !== undefined) {
      selection.mechId = Schema.decodeUnknownSync(RecordId)(values.mech);
    }
  }

  if (values.apply === true) {
    if (values['retirement-receipt'] === undefined) {
      throw new HistoryImportFailed({ reason: '--apply requires the reviewed --retirement-receipt file' });
    }

    return {
      mode: 'apply',
      selection,
      expectedDigest: Schema.decodeUnknownSync(Digest)(values['expect-digest']),
      retirementReceipt: values['retirement-receipt'],
      retirementSha256: Schema.decodeUnknownSync(Digest)(values['retirement-sha256']),
    };
  }

  if (
    values['expect-digest'] !== undefined ||
    values['retirement-receipt'] !== undefined ||
    values['retirement-sha256'] !== undefined
  ) {
    throw new HistoryImportFailed({ reason: 'Approval digests and retirement evidence apply only with --apply' });
  }

  return { mode: 'dry-run', selection, expectedDigest: null, retirementReceipt: null, retirementSha256: null };
}
