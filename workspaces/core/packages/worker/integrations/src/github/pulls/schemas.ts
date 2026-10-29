import { GitCommit, renamedWireStruct } from '@mechane/records';
import { Schema } from 'effect';

/** Provider fields used to reconcile a previously submitted source pull request. */
export const GitHubPull = renamedWireStruct({
  fields: {
    number: Schema.Int,
    isDraft: Schema.Boolean,
    /** GitHub returns null when a pull request has no body. */
    body: Schema.OptionFromNullOr(Schema.String),
    head: renamedWireStruct({ fields: { sha: GitCommit, reference: Schema.String }, renames: { reference: 'ref' } }),
    base: renamedWireStruct({ fields: { reference: Schema.String }, renames: { reference: 'ref' } }),
  },
  renames: { isDraft: 'draft' },
});

export type GitHubPull = typeof GitHubPull.Type;
