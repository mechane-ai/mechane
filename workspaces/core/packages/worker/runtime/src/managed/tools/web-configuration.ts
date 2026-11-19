import { Predicate, Schema } from 'effect';
import { hostWithin, managedWebDomains } from './web-domains.ts';
import { WebContentLimit } from './web-settings.ts';
import type { ManagedWebSettings } from './web-settings.ts';
import { managedWebSources } from './web-sources.ts';

const LOCATION_MAX_CHARACTERS = 255;
const Detail = Schema.optional(Schema.NullOr(Schema.NonEmptyString.check(Schema.isMaxLength(LOCATION_MAX_CHARACTERS))));

const UserLocation = Schema.Struct({
  type: Schema.Literal('approximate'),
  city: Detail,
  region: Detail,
  country: Schema.optional(Schema.NullOr(Schema.String.check(Schema.isPattern(/^[A-Z]{2}$/u)))),
  timezone: Detail,
});

export type ManagedWebOverride = {
  readonly allowed_domains?: ReadonlyArray<string>;
  readonly blocked_domains?: ReadonlyArray<string>;
  readonly url_sources?: ReturnType<typeof managedWebSources>;
  readonly max_content_tokens?: number;
  readonly user_location?: typeof UserLocation.Type;
};

type WebSettingsInput = {
  readonly name: 'web_search' | 'web_fetch';
  readonly value: Readonly<Record<string, unknown>>;
  readonly isEnabled: boolean;
  readonly settings: ManagedWebSettings;
};

function domainPolicy({ name, value, settings }: WebSettingsInput) {
  const isSearch = name === 'web_search';
  const allowed = managedWebDomains(value['allowed_domains'], isSearch);
  const blocked = managedWebDomains(value['blocked_domains'], isSearch);

  if (allowed !== undefined && blocked !== undefined) {
    throw new Error('Set only one of allowed_domains and blocked_domains');
  }

  if (blocked !== undefined) {
    return { blocked_domains: blocked };
  }

  if (allowed === undefined) {
    return {};
  }

  for (const entry of allowed) {
    const host = entry.split('/')[0] ?? entry;

    if (settings.allowedDomains !== undefined && !settings.allowedDomains.some((domain) => hostWithin(host, domain))) {
      throw new Error('Web tool domain is outside the installation allowlist');
    }

    if (settings.blockedDomains?.some((domain) => hostWithin(host, domain) || hostWithin(domain, host)) === true) {
      throw new Error('Web tool domain is blocked on this installation');
    }
  }

  return { allowed_domains: allowed };
}

export function resolveManagedWebOverride(input: WebSettingsInput): ManagedWebOverride {
  const { name, value, settings } = input;
  const options = ['allowed_domains', 'blocked_domains', 'url_sources', 'max_content_tokens', 'user_location'];

  if (!settings.isEnabled && (input.isEnabled || options.some((key) => Predicate.isNotNullish(value[key])))) {
    throw new Error('Web tools are disabled on this installation');
  }

  const domains = domainPolicy(input);

  if (name === 'web_search') {
    const location = value['user_location'];

    if (Predicate.isNullish(location)) {
      return domains;
    }

    const userLocation = Schema.decodeUnknownSync(UserLocation, { onExcessProperty: 'error' })(location);

    if (Predicate.isNotNullish(userLocation.timezone)) {
      Intl.DateTimeFormat('en', { timeZone: userLocation.timezone });
    }

    return { ...domains, user_location: userLocation };
  }

  const url_sources = managedWebSources(value['url_sources']);
  const limit = value['max_content_tokens'];

  if (Predicate.isNullish(limit)) {
    return { ...domains, url_sources };
  }

  const max_content_tokens = Schema.decodeUnknownSync(WebContentLimit)(limit);

  if (settings.maxContentTokens !== undefined && max_content_tokens > settings.maxContentTokens) {
    throw new Error('Web fetch content limit exceeds the installation limit');
  }

  return { ...domains, url_sources, max_content_tokens };
}
