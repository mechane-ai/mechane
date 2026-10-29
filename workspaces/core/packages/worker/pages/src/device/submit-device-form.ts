import { limitRequest } from '@mechane/bindings';
import type { WorkerSettings } from '@mechane/bindings';
import { LimitPolicy } from '@mechane/deployment';
import { DeviceForm, DeviceStep } from '@mechane/protocol';
import { Effect, Option, Record, Schema } from 'effect';
import { PageRefusal } from '../constants.ts';
import { PageRefused } from '../errors.ts';
import { browserSession } from '../session/browser-session.ts';
import { csrfToken } from '../session/csrf-token.ts';
import { identityKey } from '../session/identity-key.ts';
import { readBrowserForm } from '../session/read-browser-form.ts';
import type { PageFailure, PageInput } from '../types.ts';
import { approveDevice } from './approve-device.ts';
import { reviewDevice } from './review-device.ts';

type DeviceFormInput = { readonly request: Request; readonly settings: WorkerSettings };

/**
 * Answers a form the device page posted. Only a same-origin form with the CSRF token of the browser's live session goes
 * on, so neither a key nor another site ever reviews or approves. Each attempt counts against the session's identity.
 */
export const submitDeviceForm = Effect.fn('submitDeviceForm')(function* ({
  request,
  settings,
}: PageInput): Effect.fn.Return<Response, PageFailure> {
  const form = yield* deviceForm({ request, settings });
  const session = yield* browserSession({ request, settings });

  if (Option.isNone(session)) {
    return yield* new PageRefused({ refusal: PageRefusal.SignedOut });
  }

  const csrf = yield* csrfToken({ sessionToken: session.value.token });

  if (form.csrfToken !== csrf) {
    return yield* new PageRefused({ refusal: PageRefusal.ForgedForm });
  }

  const countedBy = identityKey({ identity: session.value });

  yield* limitRequest({ settings, policy: LimitPolicy.CodeAttempt, countedBy });

  switch (form.step) {
    case DeviceStep.Review:
      return yield* reviewDevice({ settings, session: session.value, typedCode: form.typedCode });
    case DeviceStep.Approve:
      return yield* approveDevice({ settings, session: session.value, userCode: form.userCode });
  }
});

/** The posted form, from this deployment's own origin only; any other is refused as forged. */
const deviceForm = Effect.fn('deviceForm')(function* ({
  request,
  settings,
}: DeviceFormInput): Effect.fn.Return<DeviceForm, PageRefused> {
  const fields = yield* readBrowserForm({ request, settings });

  return yield* Schema.decodeUnknownEffect(DeviceForm)(Record.fromEntries(fields)).pipe(
    Effect.mapError(() => new PageRefused({ refusal: PageRefusal.ForgedForm })),
  );
});
