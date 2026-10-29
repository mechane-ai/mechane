import { DeviceStep, ReviewForm, TYPED_CODE_FIELD, TYPED_CODE_MAX_CHARS } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
import { escapeHtml } from '@mechane/utilities';
import { Effect, Option, Record, Schema } from 'effect';
import { hiddenFields } from '../html/hidden-fields.ts';
import { renderPage } from '../html/render-page.ts';
import { browserSession } from '../session/browser-session.ts';
import { csrfToken } from '../session/csrf-token.ts';
import { startSignIn } from '../sign-in/start-sign-in.ts';
import type { PageFailure, PageInput } from '../types.ts';

/**
 * The device page signs the browser in first, then asks for the code the terminal shows. A code in the URL is ignored,
 * so no link fills the form and no request without a session learns whether a code is pending.
 */
export const showDevicePage = Effect.fn('showDevicePage')(function* ({
  request,
  settings,
}: PageInput): Effect.fn.Return<Response, PageFailure> {
  const session = yield* browserSession({ request, settings });

  if (Option.isNone(session)) {
    return yield* startSignIn({ settings });
  }

  const csrf = yield* csrfToken({ sessionToken: session.value.token });
  const encoded = Schema.encodeSync(ReviewForm)({ step: DeviceStep.Review, typedCode: '', csrfToken: csrf });
  const fields = Record.remove(encoded, TYPED_CODE_FIELD);
  const login = escapeHtml({ text: session.value.name });
  const input = `<input name="${TYPED_CODE_FIELD}" maxlength="${TYPED_CODE_MAX_CHARS}" autocomplete="off" autocapitalize="characters" spellcheck="false" required>`;

  const body = [
    `<p>You are signed in as ${login}.</p>`,
    `<form method="post">${hiddenFields({ fields })}`,
    `<p><label>Type the code your terminal shows: ${input}</label></p>`,
    '<button type="submit">Continue</button></form>',
  ].join('\n');

  return renderPage({ status: HttpStatusCode.Ok, title: 'Enter your code', body, headers: [] });
});
