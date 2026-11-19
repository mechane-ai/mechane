import { Schema } from 'effect';
import { managedWebDomains } from './web-domains.ts';

export type ManagedWebSettings = {
  readonly isEnabled: boolean;
  readonly allowedDomains: ReadonlyArray<string> | undefined;
  readonly blockedDomains: ReadonlyArray<string> | undefined;
  readonly maxContentTokens: number | undefined;
};

export const WEB_TOOLS_DISABLED = {
  isEnabled: false,
  allowedDomains: undefined,
  blockedDomains: undefined,
  maxContentTokens: undefined,
} as const satisfies ManagedWebSettings;

const WEB_CONTENT_MAX_TOKENS = 2_147_483_647;
export const WebContentLimit = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: WEB_CONTENT_MAX_TOKENS }));

function environmentDomains(input: unknown): ReadonlyArray<string> | undefined {
  if (input === undefined) {
    return undefined;
  }

  const entries = Schema.decodeUnknownSync(Schema.String)(input)
    .split(',')
    .map((entry) => entry.trim());

  return managedWebDomains(entries, false);
}

function contentLimit(input: unknown): number | undefined {
  if (input === undefined) {
    return undefined;
  }

  const value = Schema.decodeUnknownSync(Schema.NumberFromString)(input);

  return Schema.decodeUnknownSync(WebContentLimit)(value);
}

export function readManagedWebSettings(environment: Readonly<Record<string, unknown>>): ManagedWebSettings {
  const allowedDomains = environmentDomains(environment['CMA_WEB_TOOLS__ALLOWED_DOMAINS']);
  const blockedDomains = environmentDomains(environment['CMA_WEB_TOOLS__BLOCKED_DOMAINS']);

  if (allowedDomains !== undefined && blockedDomains !== undefined) {
    throw new Error('Set one of CMA_WEB_TOOLS__ALLOWED_DOMAINS or CMA_WEB_TOOLS__BLOCKED_DOMAINS');
  }

  const maxContentTokens = contentLimit(environment['CMA_WEB_TOOLS__MAX_CONTENT_TOKENS']);
  const raw = environment['CMA_WEB_TOOLS__ENABLED'];
  let isEnabled = allowedDomains !== undefined || blockedDomains !== undefined || maxContentTokens !== undefined;

  if (raw !== undefined) {
    isEnabled = Schema.decodeUnknownSync(Schema.Literals(['true', 'false']))(raw) === 'true';
  }

  return { isEnabled, allowedDomains, blockedDomains, maxContentTokens };
}
