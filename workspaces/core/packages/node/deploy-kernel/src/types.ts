import type { StepSubject } from '@mechane/program';
import type { WranglerMigrations } from '@mechane/wrangler';
import type { Duration } from 'effect';
import type { DeployMode, DeployStep } from './constants.ts';
import type { InstallationOverlay } from './installation.schemas.ts';
import type { Credentials, Invocation } from './schemas.ts';

/** A Durable Object migration of the Wrangler configuration, compared whole between two releases. */
export type WranglerMigration = WranglerMigrations['migrations'][number];

/** A member of a union of modes, picked by its mode. */
type ModeOf<M extends DeployMode> = { readonly mode: M };

type RenderInvocation = Extract<Invocation, ModeOf<typeof DeployMode.Render>>;

type UploadInvocation = Extract<Invocation, ModeOf<typeof DeployMode.Upload>>;

/** The parent variables the program's children inherit, which every mode reads. */
export type ProgramSettings = {
  readonly configurationPath: string;
  readonly installation: InstallationOverlay;
  /** `PATH`, `HOME` and `DOCKER_HOST`, which git, Docker, Bun and Wrangler inherit. */
  readonly inherited: Readonly<Record<string, string>>;
  /** The operator's SSH agent, which only git inherits, to reach `origin`. */
  readonly gitAgent: Readonly<Record<string, string>>;
  /** Where Wrangler writes its debug log, which only Wrangler inherits. */
  readonly wranglerLog: Readonly<Record<string, string>>;
};

/**
 * What a mode that reaches production reads: its command line, the variables its children inherit, and the operator's
 * files.
 */
export type OperatorSettings = Exclude<Invocation, RenderInvocation | UploadInvocation> &
  ProgramSettings & {
    /** Cloudflare credentials and the installation's selected Worker secrets, all validated and redacted. */
    readonly credentials: Credentials;
    /** The folder of the operating system's temporary files, which `TMPDIR` can move. */
    readonly temporaryRoot: string;
    /** Whether standard input is a terminal, where the operator types a tag to confirm a deploy or a rollback. */
    readonly isInteractive: boolean;
  };

/** A built CLI release upload uses explicit installation buckets and inherited Cloudflare credentials. */
export type UploadSettings = UploadInvocation &
  ProgramSettings & {
    /** The operator's Cloudflare account and its credential where set, which Wrangler reads unless a login is saved. */
    readonly cloudflare: Readonly<Record<string, string>>;
  };

/** The settings of one mode that reaches production, with its own flags. */
export type ModeSettings<M extends DeployMode> = Extract<OperatorSettings, ModeOf<M>>;

/** What the deploy program reads from its command line, its environment and the operator's env file. */
export type DeploySettings = (RenderInvocation & ProgramSettings) | UploadSettings | OperatorSettings;

/** The configuration the renderer wrote: the Worker's name, this checkout's revision, its variables and migrations. */
export type RenderedConfiguration = {
  readonly configurationPath: string;
  readonly name: string;
  readonly revision: string;
  readonly variables: Readonly<Record<string, string>>;
  readonly migrations: ReadonlyArray<WranglerMigration>;
  readonly releasesBucket: string;
  readonly workspaceBucket: string;
};

export type SettingsInput = { readonly settings: ProgramSettings };

export type OperatorSettingsInput = { readonly settings: OperatorSettings };

export type RenderedInput = { readonly rendered: Pick<RenderedConfiguration, 'variables'> };

/** A mode's operator settings, and the configuration it rendered. */
export type OperatorModeInput = { readonly settings: OperatorSettings; readonly rendered: RenderedConfiguration };

export type OriginInput = { readonly origin: URL };

export type GitInput = { readonly args: ReadonlyArray<string>; readonly settings: ProgramSettings };

/** A Wrangler command, the operator's credentials it runs with, and how long it may take. */
export type WranglerInput = {
  readonly args: ReadonlyArray<string>;
  readonly settings: ProgramSettings;
  readonly credentials: Credentials;
  readonly timeout: Duration.Duration;
};

export type WranglerVariablesInput = { readonly settings: ProgramSettings; readonly credentials: Credentials };

export type TemporaryFolderInput = { readonly settings: OperatorSettings };

/** One condition a check refuses, and the reason it gives when the condition holds. */
type Refusal = { readonly isRefused: boolean; readonly reason: string };

/** The step a check is, and the conditions it refuses. */
export type CheckRefusalsInput = {
  readonly step: DeployStep;
  /** What the check looked at, which its failure names. */
  readonly subjects: ReadonlyArray<StepSubject>;
  readonly refusals: ReadonlyArray<Refusal>;
};
