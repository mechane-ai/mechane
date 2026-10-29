import { call } from '@mechane/client';
import {
  checkRefusals,
  DEPLOY_USER_AGENT,
  DeployFailed,
  DeployStep,
  describeFailure,
  fetchAnswer,
  PROGRAM,
  REQUEST_TIMEOUT,
} from '@mechane/deploy-kernel';
import type { OriginInput } from '@mechane/deploy-kernel';
import { StepSubject, writeDiagnostic } from '@mechane/program';
import { INSTALL_SCRIPT_PATH, installScriptUrl, RELEASE } from '@mechane/protocol';
import type { Health } from '@mechane/protocol';
import { HttpHeader } from '@mechane/records';
import { Effect, Option } from 'effect';

/**
 * Checks what production serves without a key: `/health` reports this release, and `/install.sh` answers with its
 * uncompressed length, which a streamed answer would lack, and names production's origin.
 */
export function checkServed({ origin }: OriginInput): Effect.Effect<void, DeployFailed> {
  const installerUrl = installScriptUrl({ origin });

  return Effect.gen(function* () {
    const health = yield* servedHealth({ origin });

    const installer = yield* fetchAnswer({
      url: installerUrl,
      // Cloudflare's compression removes Content-Length, so inspect the identity representation.
      init: { headers: { [HttpHeader.AcceptEncoding]: 'identity' } },
      step: DeployStep.ReadInstaller,
      read: (response) => response.text(),
    });

    yield* checkRefusals({
      step: DeployStep.CheckServed,
      subjects: [StepSubject.cases.Url.make({ url: origin })],
      refusals: [
        { isRefused: health.release !== RELEASE, reason: `/health reports ${health.release}` },
        { isRefused: !installer.isOk, reason: `${INSTALL_SCRIPT_PATH} answered ${installer.status}` },
        { isRefused: !installer.headers.has('content-length'), reason: `${INSTALL_SCRIPT_PATH} has no length` },
        { isRefused: !installer.body.includes(origin.origin), reason: `${INSTALL_SCRIPT_PATH} names another origin` },
      ],
    });
    writeDiagnostic({
      program: PROGRAM,
      line: `served: /health reports ${RELEASE}; ${INSTALL_SCRIPT_PATH} has a length and names ${origin.origin}`,
    });
  });
}

/** What production's `/health` reports to the deploy program, which names its release in `user-agent`. */
const servedHealth = Effect.fn('servedHealth')(function* ({
  origin,
}: OriginInput): Effect.fn.Return<Health, DeployFailed> {
  const subjects = [StepSubject.cases.Url.make({ url: origin })];

  return yield* call({
    origin,
    name: 'health',
    input: {},
    credential: Option.none(),
    timeout: REQUEST_TIMEOUT,
    userAgent: DEPLOY_USER_AGENT,
  }).pipe(
    Effect.mapError(
      (failure) => new DeployFailed({ step: DeployStep.ReadHealth, subjects, reason: describeFailure({ failure }) }),
    ),
  );
});
