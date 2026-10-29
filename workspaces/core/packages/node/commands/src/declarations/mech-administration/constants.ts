import { FlagKind } from '../../constants.ts';

/** The CLI spellings shared by revision-checked definition and lifecycle changes. */
export const CHANGE_RENAMES = { mechId: 'mech-id', expectedRevision: 'expected-revision' } as const;

/** The revision flag required for every definition and lifecycle change. */
export const REVISION_FLAG = {
  'expected-revision': {
    kind: FlagKind.Text,
    summary: 'the current revision from mech show; refuses a concurrent edit',
  },
} as const;
