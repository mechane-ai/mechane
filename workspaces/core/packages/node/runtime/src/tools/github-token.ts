import { HttpHeader, HttpMethod, MediaType } from '@mechane/records';
import { Record } from 'effect';
import { SignJWT } from 'jose';
import { z } from 'zod';
import type { GitHubAccess } from '../domain.ts';
import { TOOL_REQUEST_TIMEOUT_MS } from './constants.ts';
import { ToolUnavailableError } from './errors.ts';
import { readBoundedJson } from './http.ts';

const GITHUB_ASSERTION_SECONDS = 300;
const GITHUB_CLOCK_MARGIN_SECONDS = 30;
const MILLISECONDS_PER_SECOND = 1000;
const GITHUB_API_VERSION = '2022-11-28';

const GITHUB_AGENT_PERMISSIONS: Readonly<Record<string, string>> = {
  contents: 'write',
  pull_requests: 'write',
  issues: 'write',
  actions: 'read',
  checks: 'read',
};

const GitHubTokenResponse = z.object({
  token: z.string().min(1),
  permissions: z.record(z.string(), z.string()),
  repositories: z.array(z.object({ id: z.number().int().positive() })),
});

type MintTokenInput = { readonly origin: string; readonly grant: GitHubAccess; readonly privateKey: string };

type RevokeTokenInput = { readonly origin: string; readonly token: string };

export async function mintGitHubToken({ origin, grant, privateKey }: MintTokenInput): Promise<string> {
  const { createPrivateKey } = await import('node:crypto');
  const nowSeconds = Math.floor(Date.now() / MILLISECONDS_PER_SECOND);
  const key = createPrivateKey(privateKey);

  const assertion = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(String(grant.appId))
    .setIssuedAt(nowSeconds - GITHUB_CLOCK_MARGIN_SECONDS)
    .setExpirationTime(nowSeconds + GITHUB_ASSERTION_SECONDS)
    .sign(key);

  const path = githubInstallationTokenPath(grant);
  const url = new URL(path, origin);

  const response = await fetch(url, {
    method: HttpMethod.Post,
    headers: {
      [HttpHeader.Authorization]: `Bearer ${assertion}`,
      [HttpHeader.Accept]: MediaType.GitHubJson,
      [HttpHeader.ContentType]: MediaType.Json,
      [HttpHeader.GitHubApiVersion]: GITHUB_API_VERSION,
      [HttpHeader.UserAgent]: 'mechane',
    },
    body: JSON.stringify({ repository_ids: [grant.repositoryId], permissions: GITHUB_AGENT_PERMISSIONS }),
    redirect: 'error',
    signal: AbortSignal.timeout(TOOL_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    await response.body?.cancel();

    throw new ToolUnavailableError(`GitHub refused the configured repository grant (${response.status})`);
  }

  const body = await readBoundedJson(response);
  const credential = GitHubTokenResponse.parse(body);

  const hasExactRepository =
    credential.repositories.length === 1 && credential.repositories[0]?.id === grant.repositoryId;

  const hasExpectedPermissions = Record.toEntries(GITHUB_AGENT_PERMISSIONS).every(
    ([name, level]) => credential.permissions[name] === level,
  );

  const hasOnlyExpectedPermissions = Record.toEntries(credential.permissions).every(([name, level]) => {
    if (name === 'metadata' && level === 'read') {
      return true;
    }

    return GITHUB_AGENT_PERMISSIONS[name] === level;
  });

  if (!hasExactRepository || !hasExpectedPermissions || !hasOnlyExpectedPermissions) {
    await revokeGitHubToken({ origin, token: credential.token });

    throw new ToolUnavailableError('GitHub returned a credential outside the configured repository grant');
  }

  return credential.token;
}

export async function revokeGitHubToken({ origin, token }: RevokeTokenInput): Promise<void> {
  const response = await fetch(new URL('/installation/token', origin), {
    method: HttpMethod.Delete,
    headers: {
      [HttpHeader.Authorization]: `Bearer ${token}`,
      [HttpHeader.Accept]: MediaType.GitHubJson,
      [HttpHeader.GitHubApiVersion]: GITHUB_API_VERSION,
      [HttpHeader.UserAgent]: 'mechane',
    },
    redirect: 'error',
    signal: AbortSignal.timeout(TOOL_REQUEST_TIMEOUT_MS),
  });

  await response.body?.cancel();

  if (!response.ok) {
    throw new Error(`GitHub could not revoke the execution token (${response.status})`);
  }
}

function githubInstallationTokenPath({ installationId }: Pick<GitHubAccess, 'installationId'>): string {
  return `/app/installations/${installationId}/access_tokens`;
}
