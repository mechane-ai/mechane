import type {
  Credentials,
  DeployMode,
  ModeSettings,
  OperatorSettings,
  ProgramSettings,
  RenderedConfiguration,
  WorkerVersionId,
} from '@mechane/deploy-kernel';
import type { Readiness, Release } from '@mechane/protocol';
import type { Duration, Option } from 'effect';

type RollbackSettings = ModeSettings<typeof DeployMode.Rollback>;

export type ConfirmTagInput = {
  readonly settings: OperatorSettings;
  readonly tag: string;
  /** What the typed tag lets the program do, such as `deploy`. */
  readonly action: string;
};

/** The release and revision readiness must report, what it reported before, and how long the wait may take. */
export type AwaitReadinessInput = {
  readonly origin: URL;
  readonly release: Release;
  readonly revision: string;
  /** None on a first deploy, or when production's readiness did not answer before. */
  readonly before: Option.Option<Readiness>;
  readonly timeout: Duration.Duration;
};

export type LoweredClassesInput = {
  /** None on a first deploy, or when production's readiness did not answer before. */
  readonly before: Option.Option<Readiness>;
  readonly readiness: Readiness;
};

export type RollBackInput = { readonly settings: RollbackSettings; readonly rendered: RenderedConfiguration };

/** The Worker whose traffic moves, the version that takes all of it, and why. */
export type SendTrafficInput = {
  readonly credentials: Credentials;
  readonly name: string;
  readonly versionId: WorkerVersionId;
  readonly message: string;
};

export type SameFormatsInput = {
  readonly settings: ProgramSettings;
  readonly target: string;
  readonly deployed: string;
};
