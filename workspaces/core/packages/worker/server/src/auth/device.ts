import type { DeviceApprovalRecord } from '@mechane/control-store';
import { DeviceForm, DeviceStep, UserCode, userCodeOf } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode, MediaType } from '@mechane/records';
import { hashAuthToken, limitAuthentication, resolveAuthentication } from '@mechane/runtime';
import { escapeHtml } from '@mechane/utilities';
import { Record, Schema } from 'effect';
import { timingSafeEqual } from 'node:crypto';
import { readTextBody } from '../http/body.ts';
import { readCookie, requireBrowserOrigin } from './cookies.ts';
import { authPage, AuthPageError } from './page.ts';
import type { AuthRequest, SessionCookie } from './types.ts';

const SECONDS_PER_HOUR = 3600;
const APPROVAL_PURPOSE = { login: 'Sign in to the CLI', named: 'Create an API key' } as const;

async function browserSession({ request, store, configuration }: AuthRequest): Promise<SessionCookie | null> {
  const token = readCookie({ request, origin: configuration.origin, name: 'session' });

  if (token === null) {
    return null;
  }

  const caller = await resolveAuthentication({ store, configuration, credential: { kind: 'session', token } });

  if (caller.principalId === null) {
    return null;
  }

  return { token, principalId: caller.principalId };
}

function csrfToken(token: string, origin: string): string {
  return hashAuthToken(`${origin}:device:${token}`);
}

function csrfMatches(supplied: string, expected: string): boolean {
  const encoder = new TextEncoder();
  const suppliedHash = encoder.encode(hashAuthToken(supplied));
  const expectedHash = encoder.encode(hashAuthToken(expected));

  return timingSafeEqual(suppliedHash, expectedHash);
}

function codeForm(csrf: string): string {
  return `<p>Enter the code shown in your terminal. Only approve a request you started.</p><form method="post" action="/device"><input type="hidden" name="step" value="${DeviceStep.Review}"><input type="hidden" name="csrf_token" value="${escapeHtml({ value: csrf })}"><label for="code">Device code</label><input id="code" name="code" placeholder="BCDF-GHJK" autocomplete="off" autocapitalize="characters" maxlength="32" required autofocus><button type="submit">Review request</button></form>`;
}

function reviewForm(approval: DeviceApprovalRecord, code: string, csrf: string): string {
  const purpose = APPROVAL_PURPOSE[approval.purpose];
  const lifetimeHours = approval.keyLifetimeSeconds / SECONDS_PER_HOUR;

  return `<p>This key can act as your account within your current workspace memberships.</p><dl><dt>Request</dt><dd>${escapeHtml({ value: purpose })}</dd><dt>Key name</dt><dd>${escapeHtml({ value: approval.name })}</dd><dt>Lifetime</dt><dd>${lifetimeHours} hours from issuance</dd><dt>Requested</dt><dd>${escapeHtml({ value: approval.createdAt })}</dd><dt>Code</dt><dd>${escapeHtml({ value: code })}</dd></dl><form method="post" action="/device"><input type="hidden" name="step" value="${DeviceStep.Approve}"><input type="hidden" name="user_code" value="${escapeHtml({ value: code })}"><input type="hidden" name="csrf_token" value="${escapeHtml({ value: csrf })}"><button type="submit">Approve request</button></form>`;
}

export async function showDevice(input: AuthRequest): Promise<Response> {
  const session = await browserSession(input);

  if (session === null) {
    return authPage({
      title: 'Authorize your CLI',
      content:
        '<p>Sign in before entering the code from your terminal.</p><p><a href="/auth/sign-in?returnTo=%2Fdevice">Sign in with GitHub</a></p>',
    });
  }

  return authPage({
    title: 'Authorize your CLI',
    content: codeForm(csrfToken(session.token, input.configuration.origin)),
  });
}

function normalizedCode(typedCode: string): string {
  const letters = typedCode.replaceAll(/[\s-]/g, '').toUpperCase();
  const code = userCodeOf({ letters });

  try {
    return Schema.decodeUnknownSync(UserCode)(code);
  } catch {
    throw new AuthPageError(
      'No pending request matches that code. Check your terminal and try again.',
      HttpStatusCode.NotFound,
    );
  }
}

export async function submitDevice(input: AuthRequest): Promise<Response> {
  const { request, store, configuration } = input;

  requireBrowserOrigin(request, configuration.origin);

  const session = await browserSession(input);

  if (session === null) {
    throw new AuthPageError('Sign in before approving a device.', HttpStatusCode.Unauthorized);
  }

  await limitAuthentication({ store, configuration, policy: 'codeAttempt', subject: session.principalId });

  if (request.headers.get(HttpHeader.ContentType)?.startsWith(MediaType.FormUrlEncoded) !== true) {
    throw new AuthPageError('The device request must be submitted from its review form.', HttpStatusCode.BadRequest);
  }

  const text = await readTextBody(request);
  const form = decodeDeviceForm(text);
  const csrf = csrfToken(session.token, configuration.origin);

  if (!csrfMatches(form.csrfToken, csrf)) {
    throw new AuthPageError('The device form expired. Reload and enter its code again.', HttpStatusCode.BadRequest);
  }

  if (form.step === DeviceStep.Review) {
    const code = normalizedCode(form.typedCode);
    const approval = await store.auth.findPendingDeviceApproval({ userCodeHash: hashAuthToken(code) });

    if (approval === null) {
      throw new AuthPageError(
        'No pending request matches that code. Check your terminal and try again.',
        HttpStatusCode.NotFound,
      );
    }

    return authPage({ title: 'Review device request', content: reviewForm(approval, code, csrf) });
  }

  const approval = await store.auth.approveDevice({
    userCodeHash: hashAuthToken(form.userCode),
    sessionTokenHash: hashAuthToken(session.token),
  });

  if (approval === null) {
    throw new AuthPageError(
      'No pending request matches that code. Check your terminal and try again.',
      HttpStatusCode.NotFound,
    );
  }

  return authPage({
    title: 'Device approved',
    content: `<p>You approved ${escapeHtml({ value: approval.name })}. Return to your terminal to finish.</p>`,
  });
}

function decodeDeviceForm(text: string): DeviceForm {
  try {
    return Schema.decodeUnknownSync(DeviceForm, { onExcessProperty: 'error' })(
      Record.fromEntries(new URLSearchParams(text)),
    );
  } catch {
    throw new AuthPageError('The device request is invalid. Enter its code again.', HttpStatusCode.BadRequest);
  }
}
