import type { SourceTask } from '@mechane/mech-store';
import { SourceAction } from '@mechane/protocol';
import { SourceAnswer } from '@mechane/rpc';
import { checkoutSource } from '../checkout/checkout-source.ts';
import { sourceAnswer } from '../context/source-answer.ts';
import { publishSource } from '../publication/publish-source.ts';
import type { SourceManagement } from './types.ts';

type ExistingSourceManagement = SourceManagement & { readonly source: SourceTask };

/** Retries retain the source's pinned commit and immutable publication intent. */
export async function advanceSource({
  mech,
  owner,
  sandbox,
  request,
  principalId,
  source,
}: ExistingSourceManagement): Promise<SourceAnswer> {
  if (request.action === SourceAction.Checkout && request.commit !== source.commit) {
    return SourceAnswer.cases.Refused.make({ reason: 'source identity already names another commit' });
  }

  if (request.action === SourceAction.Publish) {
    return await publishSource({ mech, owner, sandbox, source, request, principalId });
  }

  if (request.action === SourceAction.Show) {
    return sourceAnswer({ source });
  }

  const next = await checkoutSource({ mech, owner, sandbox, source });

  return sourceAnswer({ source: next });
}
