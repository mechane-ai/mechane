import { BrowserEvidenceProgress } from '@mechane/protocol';
import { BrowserAction, InstalledActionOrigin } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { ManagedContext } from '../managed-context.ts';
import { postInstalledAction } from './managed-process-action.ts';
import { installedComputerResourcePath } from './managed-process-path.ts';

const Capture = Schema.Struct({ origin: InstalledActionOrigin, viewer_url: Schema.optionalKey(Schema.NonEmptyString) });

const BrowserReceipt = Schema.Struct({
  progress: BrowserEvidenceProgress.fields.progress,
  origin: InstalledActionOrigin,
  evidence: Schema.OptionFromNullOr(Capture),
});

export async function runInstalledBrowserAction(
  context: ManagedContext,
  action: BrowserAction,
  actionId = randomUUID(),
) {
  const resource = installedComputerResourcePath({ collection: 'browser', id: actionId });
  const body = Schema.encodeSync(BrowserAction)(action);
  const answer = await postInstalledAction(context, { resource, body, schema: BrowserReceipt });

  assert.equal(answer.origin.actionId, actionId);
  assert.equal(answer.origin.sessionId, context.session.id);

  if (answer.progress._tag !== 'Ready') {
    throw new Error(`Browser action did not settle: ${answer.progress._tag}`);
  }

  return { result: answer.progress.response.result, evidence: answer.evidence };
}
