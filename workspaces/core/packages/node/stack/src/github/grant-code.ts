import { GitHubLogin } from '@mechane/program';
import { grantedCallbackUrl } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import { Option, Record, Result, Schema } from 'effect';
import type { ServedAnswer } from '../types.ts';
import { jsonAnswer } from './json-answer.ts';
import { registeredQuery } from './registered-query.ts';
import type { RouteInput } from './types.ts';

/** The local GitHub's own sign-in form: the login the person signs in as, which a real GitHub would authenticate. */
const SignInForm = Schema.Struct({ login: GitHubLogin });

type SignInForm = typeof SignInForm.Type;

/** Signs in as the form's login, and returns the browser to the callback with a fresh code and the state. */
export function grantCode({ request, ledger, github }: RouteInput): ServedAnswer {
  const query = registeredQuery({ request, github });
  const form = Result.getSuccess(Schema.decodeUnknownResult(SignInForm)(Record.fromEntries(request.form)));

  if (Option.isNone(query) || Option.isNone(form)) {
    return jsonAnswer({ status: HttpStatusCode.BadRequest, body: { error: 'invalid_request' } });
  }

  const { redirectUri, state } = query.value;
  const authorizationCode = ledger.grantCode({ login: form.value.login, redirectUri });

  return {
    status: HttpStatusCode.Found,
    headers: { [HttpHeader.Location]: grantedCallbackUrl({ redirectUri, authorizationCode, state }) },
    body: '',
  };
}
