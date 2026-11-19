import { ManagedGitIdentity } from '@mechane/sandbox-wire';
import { Schema } from 'effect';

const MEBIBYTE = 1_048_576;
const DEFAULT_SESSION_BYTES = 8_589_934_592;
const DEFAULT_PUSH_BYTES = 2_147_483_648;
const DEFAULT_CONCURRENT_TRANSFERS = 32;
const Host = Schema.NonEmptyString.check(Schema.isPattern(/^[a-z0-9.-]+(?::[0-9]{1,5})?$/u));
const Hostname = Schema.NonEmptyString.check(Schema.isPattern(/^[a-z0-9.-]+$/u));
const Branch = Schema.NonEmptyString.check(Schema.isPattern(/^refs\/heads\//u));
const TransferBytes = Schema.Int.check(Schema.isGreaterThanOrEqualTo(MEBIBYTE));

const GitSettings = Schema.Struct({
  allowedHostnames: Schema.optionalKey(Schema.Array(Host)),
  privateHostnames: Schema.optionalKey(Schema.Array(Hostname)),
  allowedPushRefs: Schema.optionalKey(Schema.Array(Branch)),
  maxConcurrentRequests: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThan(0))),
  commitAuthorName: Schema.optionalKey(ManagedGitIdentity.fields.commitAuthorName),
  commitAuthorEmail: Schema.optionalKey(ManagedGitIdentity.fields.commitAuthorEmail),
  maxSessionTransferBytes: Schema.optionalKey(Schema.Union([Schema.Literal(0), TransferBytes])),
  maxPushBytes: Schema.optionalKey(TransferBytes),
});

type SettingsBindings = Readonly<Record<string, unknown>>;

function gitHostUrl(authority: string): string {
  return `https://${authority}`;
}

function parseHost(authority: string): URL {
  const origin = gitHostUrl(authority);
  const parsed = new URL(origin);

  if (parsed.hostname.endsWith('.') || parsed.port === '0') {
    throw new Error('Invalid Git host in MECHANE_MANAGED_GIT');
  }

  return parsed;
}

export function readManagedGitSettings(environment: SettingsBindings) {
  const encoded = environment['MECHANE_MANAGED_GIT'] ?? '{}';

  if (typeof encoded !== 'string') {
    throw new TypeError('Invalid MECHANE_MANAGED_GIT configuration');
  }

  const decode = Schema.decodeUnknownSync(Schema.fromJsonString(GitSettings), { onExcessProperty: 'error' });
  const value = decode(encoded);

  if ((value.commitAuthorName === undefined) !== (value.commitAuthorEmail === undefined)) {
    throw new Error('Configure Git commitAuthorName and commitAuthorEmail together');
  }

  const authorities = value.allowedHostnames ?? [];

  const hosts = authorities.map(parseHost);
  const privateHostnames = value.privateHostnames ?? [];

  if (!privateHostnames.every((hostname) => hosts.some((host) => host.hostname === hostname))) {
    throw new Error('Private Git hosts must also be in allowedHostnames');
  }

  return {
    allowedHostnames: hosts.map((host) => host.host),
    privateHostnames,
    allowedPushRefs: value.allowedPushRefs ?? [],
    maxConcurrentRequests: value.maxConcurrentRequests ?? DEFAULT_CONCURRENT_TRANSFERS,
    maxSessionTransferBytes: value.maxSessionTransferBytes ?? DEFAULT_SESSION_BYTES,
    commitAuthorName: value.commitAuthorName ?? 'Claude',
    commitAuthorEmail: value.commitAuthorEmail ?? 'noreply@anthropic.com',
    maxPushBytes: value.maxPushBytes ?? DEFAULT_PUSH_BYTES,
  };
}

export type ManagedGitSettings = ReturnType<typeof readManagedGitSettings>;
