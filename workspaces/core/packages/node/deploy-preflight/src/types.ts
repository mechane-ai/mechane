import type {
  Credentials,
  OpenRouterCredit,
  OperatorSettings,
  ProgramSettings,
  RenderedConfiguration,
  WranglerMigration,
} from '@mechane/deploy-kernel';
import type { Lock } from '@mechane/program';
import type { Readiness } from '@mechane/protocol';
import type { Option } from 'effect';

export type DeployedStateInput = {
  readonly settings: OperatorSettings;
  readonly rendered: RenderedConfiguration;
  readonly origin: URL;
};

/** What production runs: the tag of its release, as Cloudflare reports it, and that release's readiness. */
export type DeployedRelease = {
  readonly tag: string;
  /** Absent when production's readiness did not answer, as after a release that broke it. */
  readonly readiness: Option.Option<Readiness>;
};

export type WorkerUploadedInput = { readonly credentials: Credentials; readonly name: string };

export type RevisionInput = { readonly revision: string; readonly settings: ProgramSettings };

/** A file of JSON at a revision, relative to the product workspace, and the schema it decodes with. */
export type DecodedAtInput<S> = {
  readonly revision: string;
  readonly path: string;
  readonly schema: S;
  readonly settings: ProgramSettings;
};

/** The stored and shipped formats of one revision, which a deploy may only append to and a rollback must share. */
export type ReleaseFormats = {
  readonly migrations: ReadonlyArray<WranglerMigration>;
  /** Every shipped name, by kind, as the revision's wire lock holds it. */
  readonly wireLock: Lock;
  /** Every schema step of the stores and of Wrangler, as the revision's migration lock holds it. */
  readonly migrationLock: Lock;
};

export type AppendOnlyInput = {
  readonly settings: ProgramSettings;
  /** None on a first deploy, when production runs nothing. */
  readonly deployed: Option.Option<DeployedRelease>;
  readonly rendered: RenderedConfiguration;
};

/** What the preflight found: production's origin, and what production runs. */
export type Preflight = {
  readonly origin: URL;
  /** None on a first deploy, when production runs nothing. */
  readonly deployed: Option.Option<DeployedRelease>;
};

export type SummaryInput = {
  readonly rendered: RenderedConfiguration;
  /** None on a first deploy, when production runs nothing. */
  readonly deployed: Option.Option<DeployedRelease>;
  readonly migrationTags: ReadonlyArray<string>;
  /** Absent when the configured model provider is not OpenRouter. */
  readonly credit: Option.Option<OpenRouterCredit>;
};
