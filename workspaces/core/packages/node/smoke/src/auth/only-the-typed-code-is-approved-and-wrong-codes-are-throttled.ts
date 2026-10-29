import { SUCCESS_STATUS } from '@mechane/program';
import { DeviceStep, ReviewForm, TYPED_CODE_FIELD } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import {
  check,
  cliResult,
  FORGED_CSRF_TOKEN,
  freshAccount,
  SignedIn,
  signedInBrowser,
  startCli,
} from '@mechane/testing';
import type { Page, ScenarioFailure, ScenarioInput } from '@mechane/testing';
import { Array, Effect, Schema } from 'effect';
import type { Scope } from 'effect';
import { linkedCodeQuery } from './linked-code-query.ts';
import { wrongCode } from './wrong-code.ts';

/**
 * How many codes no approval awaits the throttled account types. Its review, approval and reused review took three of
 * the ten attempts a window allows, so the eighth wrong code is the first past them.
 */
const WRONG_CODES = 8;

/** The command whose device approval the typed-code scenario approves. */
const LOGIN_ARGS = ['auth', 'login'] as const;

/** The pages of the typed-code scenario, and the code its login's notice named. */
type DevicePages = {
  readonly userCode: string;
  readonly linked: Page;
  readonly forged: Page;
  readonly reviewed: Page;
  readonly approved: Page;
  readonly reused: Page;
  readonly wrong: Array.NonEmptyReadonlyArray<Page>;
};

/** The conditions that a scenario's pages answered as they must, and what they answered. */
type DeviceVerdict = { readonly conditions: ReadonlyArray<boolean>; readonly detail: string };

/**
 * A device page opened from a link carrying its code shows an empty form, and a review posted without the page's CSRF
 * token is refused. The code the signed-in approver types reviews and approves the login, which the CLI finishes, and
 * the approved code then answers exactly as one never issued. Wrong codes from one GitHub user end in a 429 past the
 * ten attempts of the user's window, where each review and approval counts.
 */
export const onlyTheTypedCodeIsApprovedAndWrongCodesAreThrottled = Effect.fn(
  'onlyTheTypedCodeIsApprovedAndWrongCodesAreThrottled',
)(function* ({ stack, guarantee }: ScenarioInput): Effect.fn.Return<void, ScenarioFailure, Scope.Scope> {
  const account = yield* freshAccount({ stack });
  const started = yield* startCli({ stack, args: LOGIN_ARGS, environment: account.environment });
  const { url, userCode } = yield* started.approval;
  const browser = yield* signedInBrowser({ url, login: account.login });
  const linked = yield* browser.open({ url: new URL(linkedCodeQuery({ userCode }), url) });
  const typed = { [TYPED_CODE_FIELD]: userCode };
  const review = { step: DeviceStep.Review, typedCode: userCode, csrfToken: FORGED_CSRF_TOKEN };
  const forged = yield* browser.submit({ page: linked, fields: Schema.encodeSync(ReviewForm)(review) });
  const reviewed = yield* browser.submit({ page: linked, fields: typed });
  const approved = yield* browser.submit({ page: reviewed, fields: {} });

  yield* cliResult({ args: LOGIN_ARGS, run: yield* started.finished, result: SignedIn, status: SUCCESS_STATUS });

  const reused = yield* browser.submit({ page: linked, fields: typed });

  const typeCode: (code: string) => Effect.Effect<Page, ScenarioFailure> = (code) =>
    browser.submit({ page: linked, fields: { [TYPED_CODE_FIELD]: code } });

  const wrong = yield* Effect.forEach(Array.makeBy(WRONG_CODES, wrongCode), typeCode, { concurrency: 1 });

  yield* check({ name: guarantee, ...deviceVerdict({ userCode, linked, forged, reviewed, approved, reused, wrong }) });
}, Effect.scoped);

/**
 * Whether each page answered as it must. The linked form shows no code, the forged review is refused, and the typed
 * code is reviewed and approved. The approved code answers as the first wrong one, and the last wrong one is
 * throttled.
 */
function deviceVerdict({ userCode, linked, forged, reviewed, approved, reused, wrong }: DevicePages): DeviceVerdict {
  const isCodeShown = linked.text.includes(userCode);
  const first = Array.headNonEmpty(wrong);
  const last = Array.lastNonEmpty(wrong);

  return {
    conditions: [
      linked.status === HttpStatusCode.Ok,
      !isCodeShown,
      forged.status === HttpStatusCode.Forbidden,
      reviewed.status === HttpStatusCode.Ok,
      approved.status === HttpStatusCode.Ok,
      reused.status === HttpStatusCode.NotFound,
      reused.status === first.status,
      reused.text === first.text,
      last.status === HttpStatusCode.TooManyRequests,
      last.headers.has(HttpHeader.RetryAfter),
    ],
    detail: `the linked page answered ${linked.status}, showing the code: ${isCodeShown}; the forged review ${forged.status}; the review ${reviewed.status} and the approval ${approved.status}; the approved code ${reused.status}, alike the first wrong one: ${reused.text === first.text}; the wrong codes ${wrong.map(({ status }) => status).join(', ')}`,
  };
}
