import { BYTES_PER_KIBIBYTE, BYTES_PER_MEBIBYTE } from '@mechane/records';
import { Schema } from 'effect';
import { isIPv4 } from 'node:net';
import { readManagedIdentitySettings } from './identity-settings.ts';
import type { ManagedIdentitySettings } from './identity-settings.ts';
import { validateManagedMcpIdentity } from './identity.ts';

export type ManagedMcpSettings = {
  readonly allowedHostnames: ReadonlySet<string>;
  readonly privateHostnames: ReadonlySet<string>;
  readonly maxResultBytes: number;
  readonly agentIdentity: ManagedIdentitySettings | null;
};

const SERVER_NAME_MAX_CHARS = 255;
const SERVER_URL_MAX_CHARS = 2048;
const SERVER_MAX_ENTRIES = 20;
const DEFAULT_RESULT_KIBIBYTES = 100;
const RESPONSE_BUFFER_MEBIBYTES = 8;
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '[::1]']);
const HTTPS_PREFIX = 'https://';

const ServerEntry = Schema.Struct({
  name: Schema.NonEmptyString.check(Schema.isMaxLength(SERVER_NAME_MAX_CHARS)),
  type: Schema.Literal('url'),
  url: Schema.NonEmptyString.check(Schema.isMaxLength(SERVER_URL_MAX_CHARS)),
  auth: Schema.optional(Schema.Unknown),
  agent_token_header: Schema.optional(Schema.Unknown),
});

export const MCP_RESULT_TRUNCATED = '[MCP result truncated]';
export const MCP_ENVELOPE_TRUNCATED = '[MCP result truncated; outcome unconfirmed]';

const MIN_RESULT_BYTES = new TextEncoder().encode(
  JSON.stringify([{ type: 'text', text: MCP_ENVELOPE_TRUNCATED }]),
).byteLength;

const DEFAULT_RESULT_BYTES = DEFAULT_RESULT_KIBIBYTES * BYTES_PER_KIBIBYTE;

// The transport buffers a JSON-RPC envelope before decoding the public, truncated result.
export const MCP_RESPONSE_BUFFER_BYTES = RESPONSE_BUFFER_MEBIBYTES * BYTES_PER_MEBIBYTE;

function isManagedLoopback(host: string): boolean {
  return LOOPBACK_HOSTS.has(host) || (isIPv4(host) && host.startsWith('127.'));
}

function hostnames(value: unknown): ReadonlySet<string> {
  if (value === undefined) {
    return new Set();
  }

  const names = Schema.decodeUnknownSync(Schema.Array(Schema.NonEmptyString))(
    JSON.parse(Schema.decodeUnknownSync(Schema.String)(value)),
  );

  for (const name of names) {
    if (!URL.canParse(`${HTTPS_PREFIX}${name}`)) {
      throw new Error('Invalid managed MCP hostname setting');
    }

    const parsed = new URL(`${HTTPS_PREFIX}${name}`);

    if (parsed.hostname !== name.toLowerCase() || parsed.hostname.includes('*')) {
      throw new Error('Managed MCP settings require exact hostnames');
    }
  }

  return new Set(names.map((name) => name.toLowerCase()));
}

export function readManagedMcpSettings(environment: Readonly<Record<string, unknown>>): ManagedMcpSettings {
  const maxResultBytes = Number(environment['MECHANE_MCP_MAX_RESULT_BYTES'] ?? DEFAULT_RESULT_BYTES);

  if (
    !Number.isSafeInteger(maxResultBytes) ||
    maxResultBytes < MIN_RESULT_BYTES ||
    maxResultBytes > MCP_RESPONSE_BUFFER_BYTES
  ) {
    throw new Error(
      `MECHANE_MCP_MAX_RESULT_BYTES must be between ${MIN_RESULT_BYTES} and ${MCP_RESPONSE_BUFFER_BYTES}`,
    );
  }

  const allowedHostnames = hostnames(environment['MECHANE_MCP_ALLOWED_HOSTNAMES']);
  const privateHostnames = hostnames(environment['MECHANE_MCP_PRIVATE_HOSTNAMES']);

  if ([...privateHostnames].some((name) => !allowedHostnames.has(name))) {
    throw new Error('Private MCP hostnames must also be allowed');
  }

  return {
    allowedHostnames,
    privateHostnames,
    maxResultBytes,
    agentIdentity: readManagedIdentitySettings(environment),
  };
}

export function managedMcpUrl(value: string, settings: ManagedMcpSettings): URL {
  if (!URL.canParse(value)) {
    throw new Error('Invalid managed MCP server URL');
  }

  const url = new URL(value);

  if (!settings.allowedHostnames.has(url.hostname)) {
    throw new Error('MCP server hostname is not allowed on this installation');
  }

  const isLoopbackHttp = url.protocol === 'http:' && isManagedLoopback(url.hostname);
  const isSecure = isLoopbackHttp || url.protocol === 'https:';
  const includesUserOrFragment = [url.username, url.password, url.hash].some((part) => part.length > 0);

  if (!isSecure || includesUserOrFragment) {
    throw new Error('MCP requires an approved HTTPS URL or an explicitly allowed loopback HTTP URL');
  }

  return url;
}

export function validateManagedMcpServers(servers: unknown, settings: ManagedMcpSettings): string | null {
  const decoded = Schema.decodeUnknownResult(Schema.Array(ServerEntry), { onExcessProperty: 'error' })(servers);

  if (decoded._tag !== 'Success') {
    return 'Invalid MCP server list';
  }

  if (decoded.success.length > SERVER_MAX_ENTRIES) {
    return 'At most 20 MCP servers may be configured';
  }

  const names = new Set<string>();

  try {
    for (const server of decoded.success) {
      if (names.has(server.name)) {
        return 'MCP server names must be distinct';
      }

      names.add(server.name);
      managedMcpUrl(server.url, settings);
      validateManagedMcpIdentity({ configuration: settings.agentIdentity, server });
    }

    return null;
  } catch (error) {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Invalid managed MCP configuration';
  }
}
