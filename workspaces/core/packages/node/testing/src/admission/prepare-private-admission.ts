import { TYPED_CODE_FIELD, WorkspaceList } from '@mechane/protocol';
import { WorkspaceId } from '@mechane/records';
import { Array, Effect, Redacted } from 'effect';
import type { Scope } from 'effect';
import { freshAccount } from '../accounts/fresh-account.ts';
import { savedLoginToken } from '../accounts/saved-login-token.ts';
import { signedInBrowser } from '../browser/signed-in-browser.ts';
import { runCli } from '../cli/run-cli.ts';
import { startCli } from '../cli/start-cli.ts';
import { signedInMech } from '../mechs/signed-in-mech.ts';
import type { ScenarioFailure, StackInput } from '../types.ts';
import type { PrivateAdmissionFixture } from './types.ts';

/** Captures working credentials before the installation removes their identity admission. */
export const preparePrivateAdmission = Effect.fn('preparePrivateAdmission')(function* ({
  stack,
}: StackInput): Effect.fn.Return<PrivateAdmissionFixture, ScenarioFailure, Scope.Scope> {
  const mech = yield* signedInMech({ stack, offer: 'echo' });
  const listing = { stack, args: ['workspace', 'list'], environment: mech.account.environment, result: WorkspaceList };
  const listed = yield* runCli(listing);
  const personal = Array.headNonEmpty(listed.result.workspaces);
  const workspaceId = WorkspaceId.make(personal.id);
  const saved = yield* savedLoginToken({ account: mech.account });
  const credential = Redacted.make(saved.token);
  const pending = yield* freshAccount({ stack });
  const started = yield* startCli({ stack, args: ['auth', 'login'], environment: pending.environment });
  const approval = yield* started.approval;
  const browser = yield* signedInBrowser({ url: approval.url, login: mech.account.login });
  const form = yield* browser.open({ url: approval.url });
  const review = yield* browser.submit({ page: form, fields: { [TYPED_CODE_FIELD]: approval.userCode } });
  const approvalAttempt = browser.submit({ page: review, fields: {} });

  return { mech, workspaceId, credential, pendingLogin: pending.login, approvalUrl: approval.url, approvalAttempt };
});
