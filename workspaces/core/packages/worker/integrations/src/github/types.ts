import type { SecureOrigin } from '@mechane/deployment';
import type { SourceGrant } from '@mechane/protocol';
import type { Redacted } from 'effect';

/** A repository operation constrained to one owner-approved grant. */
export type GitHubRepositoryInput = GitHubAuthorization & { readonly grant: SourceGrant };

/** A provider origin paired with its server-held credential. */
export type GitHubAuthorization = { readonly origin: SecureOrigin; readonly token: Redacted.Redacted };
