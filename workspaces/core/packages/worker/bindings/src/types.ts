import type { CredentialKeyring } from '@mechane/deployment';
import type { KeyPurpose, ReleaseFailure } from '@mechane/protocol';
import type { MediaType } from '@mechane/records';
import type { ObjectBindings, SecretReader } from '@mechane/rpc';
import type { Duration, Effect, Option, Redacted } from 'effect';
import type { WorkerVariables } from './schemas.ts';

/** Response metadata chosen by the public release route, independent of the storage provider. */
export type ReleaseFile = { readonly contentType: MediaType; readonly cacheControl: string };

type ReadReleaseFileInput = { readonly key: string; readonly file: ReleaseFile };

/** Reads a route's release key from the configured source without exposing source URLs to clients. */
export type ReleaseFileReader = (input: ReadReleaseFileInput) => Effect.Effect<Response, ReleaseFailure>;

/** The variables as the Worker uses them, with each purpose's key lifetime in place of its two variables. */
type WorkerConfiguration = Omit<
  WorkerVariables,
  'loginKeyLifetimeSeconds' | 'namedKeyLifetimeSeconds' | 'githubClientSecret' | 'credentialKeyring' | 'releaseOrigin'
>;

/** Everything the Worker reads from its environment, decoded once per request. */
export type WorkerSettings = WorkerConfiguration &
  ObjectBindings & {
    /** Absent when GitHub sign-in is disabled; local bootstrap must provide sign-in instead. */
    readonly githubClientSecret: Option.Option<SecretReader<Redacted.Redacted>>;
    readonly credentialKeyring: SecretReader<CredentialKeyring>;
    /** The lifetime of a new key of each purpose. */
    readonly keyLifetimes: Readonly<Record<KeyPurpose, Duration.Duration>>;
    readonly readReleaseFile: ReleaseFileReader;
  };
