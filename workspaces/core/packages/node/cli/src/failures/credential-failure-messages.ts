import type { CredentialFailure, SavedLoginMissing, SavedLoginRejected } from '@mechane/cli-kernel';
import { API_KEY_VARIABLE, ExitStatus, PROGRAM } from '@mechane/commands';
import { Duration, Option } from 'effect';
import { answeredMessage } from './answered-message.ts';
import { bareMessage } from './bare-message.ts';
import { ownMessage } from './own-message.ts';
import type { FailureMessage, FailureMessages } from './types.ts';

type MissingLoginMessageInput = Pick<SavedLoginMissing, '_tag' | 'savedOrigin'>;

/**
 * The report of each way a command's credentials fail, under its tag: the deployment's refusal of the saved login, its
 * private files, a missing login, or its device approval.
 */
export const CREDENTIAL_FAILURE_MESSAGES: Readonly<FailureMessages<CredentialFailure | SavedLoginRejected>> = {
  SavedLoginRejected: ({ rejection, path }) =>
    answeredMessage({ failed: rejection, note: Option.some(`removed the saved login ${path}`) }),
  CredentialsFailed: ({ _tag, step, path, reason }) =>
    bareMessage({ code: _tag, status: ExitStatus.Failed, message: `${step} ${path}: ${reason}` }),
  SavedLoginMissing: ({ _tag, savedOrigin }) => missingLoginMessage({ _tag, savedOrigin }),
  VerificationUrlMismatched: ({ _tag, url }) =>
    ownMessage({
      code: _tag,
      status: ExitStatus.Failed,
      message: `the deployment named the approval page ${url.href}, which is not on its origin`,
      next: Option.some('approve nothing there, and check the origin'),
    }),
  ApprovalTimedOut: ({ _tag, userCode, timeout }) =>
    ownMessage({
      code: _tag,
      status: ExitStatus.Unavailable,
      message: `the approval of ${userCode} was still pending after ${Duration.format(timeout)}`,
      next: Option.some('run the command again'),
    }),
};

/** A command that found no key: no login is saved, or the saved one is for another origin. */
function missingLoginMessage({ _tag, savedOrigin }: MissingLoginMessageInput): FailureMessage {
  const reason: string = (() => {
    if (Option.isNone(savedOrigin)) {
      return 'no login is saved';
    }

    return `the saved login is for ${savedOrigin.value}`;
  })();

  return ownMessage({
    code: _tag,
    status: ExitStatus.Unauthenticated,
    message: `not signed in: ${reason}`,
    next: Option.some(`run ${PROGRAM} auth login, or set ${API_KEY_VARIABLE}`),
  });
}
