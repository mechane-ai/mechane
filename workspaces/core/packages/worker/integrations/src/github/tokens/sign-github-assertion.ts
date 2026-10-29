import { capturePromise } from '@mechane/utilities';
import { DateTime, Redacted, Result } from 'effect';
import { SignJWT } from 'jose';
import { createPrivateKey } from 'node:crypto';
import type { JsonWebKey } from 'node:crypto';
import { GITHUB_UNKNOWN_STATUS } from '../constants.ts';
import type { GitHubFailed } from '../errors.ts';
import { failGitHub } from '../requests/fail-github.ts';

const GITHUB_JWT_SECONDS = 300;
const GITHUB_CLOCK_MARGIN_SECONDS = 30;
const MILLISECONDS_PER_SECOND = 1000;

type SignGitHubAssertionInput = { readonly secret: Redacted.Redacted; readonly appId: number };

/** Native key parsing accepts the PKCS#1 PEM format downloaded for GitHub Apps. */
export async function signGitHubAssertion({
  secret,
  appId,
}: SignGitHubAssertionInput): Promise<Result.Result<Redacted.Redacted, GitHubFailed>> {
  const pem = Redacted.value(secret);

  const parseKey: () => JsonWebKey = () => {
    const key = createPrivateKey(pem);

    // Workers cannot convert a KeyObject through toCryptoKey, so jose imports its JWK representation.
    return key.export({ format: 'jwk' });
  };

  const key = Result.try(parseKey);

  if (Result.isFailure(key)) {
    return failGitHub({ status: GITHUB_UNKNOWN_STATUS, reason: 'GitHub App private key is invalid' });
  }

  const now = DateTime.nowUnsafe();
  const nowMillis = DateTime.toEpochMillis(now);
  const nowSeconds = Math.floor(nowMillis / MILLISECONDS_PER_SECOND);
  const issuer = String(appId);
  const jwt = new SignJWT({});

  jwt.setProtectedHeader({ alg: 'RS256' });
  jwt.setIssuer(issuer);
  jwt.setIssuedAt(nowSeconds - GITHUB_CLOCK_MARGIN_SECONDS);
  jwt.setExpirationTime(nowSeconds + GITHUB_JWT_SECONDS);

  const pending = jwt.sign(key.success);
  const signed = await capturePromise({ promise: pending });

  if (Result.isFailure(signed)) {
    return failGitHub({ status: GITHUB_UNKNOWN_STATUS, reason: 'GitHub App assertion could not be signed' });
  }

  const assertion = Redacted.make(signed.success);

  return Result.succeed(assertion);
}
