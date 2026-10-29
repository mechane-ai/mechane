import type { LocalSandboxProvider, WORKER_VARIABLES } from '@mechane/deployment';
import type { HttpStatusCode } from '@mechane/records';
import type { ReleaseFailed } from '@mechane/release';
import type { Effect, Option } from 'effect';
import type { ChildProcess } from 'node:child_process';
import type { IncomingHttpHeaders } from 'node:http';
import type { SCRIPTED_OFFERS } from './constants.ts';
import type { LocalCommand } from './dev/constants.ts';
import type { StackFailed } from './errors.ts';

/** A child process the stack started and stops. */
export type ChildInput = { readonly child: ChildProcess };

/** An answer of a local service: a status, its headers, and its body, whole or streamed in parts as they come. */
export type ServedAnswer = {
  readonly status: HttpStatusCode;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | AsyncIterable<string>;
};

/**
 * A request the scripted upstream answered with a reply: the offer it named, the usage it reported, its body, and the
 * provider session it named. Its end user is the id of the workspace it was sent for.
 */
export type AnsweredRequest = {
  readonly model: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly body: string;
  readonly sessionId: string;
  readonly user: string;
};

/** A request a local service reads to its end: its method, its URL, its headers by lowercase name, and its body. */
export type ServedRequest = {
  readonly method: string;
  readonly url: URL;
  readonly headers: IncomingHttpHeaders;
  readonly body: string;
};

/** The offers of the scripted upstream: one that echoes, and one no day's allowance covers. */
type ScriptedOffers = typeof SCRIPTED_OFFERS;

/**
 * The scripted model upstream a stack serves: its URL, the key it accepts and its offers, which the stack stages, and
 * the requests it has answered so far, oldest first.
 */
export type ScriptedUpstream = {
  readonly upstream: URL;
  readonly apiKey: string;
  readonly offers: ScriptedOffers;
  readonly requests: () => ReadonlyArray<AnsweredRequest>;
};

/** What the stack reads from the environment of the program that starts it. */
export type StackSettings = {
  /** The parent variables every child process of the stack inherits. */
  readonly inherited: Readonly<Record<string, string>>;
  /** The folder that holds each stack's state folder. */
  readonly stateRoot: string;
  /** Operator configuration for persistent local mode; disposable fixtures ignore it. */
  readonly workerVariables: StackVariables;
  /** Persistent mode requires containers; a disposable fixture may select host processes. */
  readonly sandboxProvider: LocalSandboxProvider;
  readonly localStateFolder: string;
  readonly localOrigin: URL;
  readonly localCommand: LocalCommand;
};

/** Worker variables the stack writes into `.dev.vars`, over the Wrangler configuration's, keyed by settings field. */
export type StackVariables = Readonly<Partial<Record<keyof typeof WORKER_VARIABLES, string>>>;

/** The Worker runtime shared by persistent local mode and disposable fixtures. */
export type RuntimeStack = {
  readonly origin: URL;
  readonly stateFolder: string;
  /** The staged project celld serves. */
  readonly projectFolder: string;
  readonly logFile: string;
  /** The folder in which celld keeps each of the stack's Durable Objects in its own database. */
  readonly storageFolder: string;
  /** The folder that holds each host machine's home and log. */
  readonly sandboxesFolder: string;
  readonly settings: StackSettings;
  /** The revision the stack staged as the Worker's, which readiness must report. */
  readonly workerRevision: string;
  /** Every Durable Object class the Wrangler configuration migrates, which readiness must report. */
  readonly durableObjectClasses: ReadonlyArray<string>;
  /**
   * Kills celld, as a crash of the host would, and starts it again on the same state with `variables` over the staged
   * ones, as a deploy with another configuration would. The host launcher and its machines run on.
   */
  readonly restart: (input: RestartInput) => Effect.Effect<void, StackFailed>;
  /** Publishes built releases into the stack's own bucket, as the release program uploads them to production's. */
  readonly publish: (input: PublishInput) => Effect.Effect<void, StackFailed | ReleaseFailed>;
};

/** A disposable Worker runtime with its scripted model, GitHub service, and optional host launcher. */
export type Stack = RuntimeStack & {
  readonly githubOrigin: URL;
  readonly modelUpstream: ScriptedUpstream;
  /** Absent when the fixture uses container sandboxes instead of the host launcher. */
  readonly launcherKey: Option.Option<string>;
};

/** A persistent Worker runtime whose bootstrap credential remains in the private installation directory. */
export type LocalStack = RuntimeStack & { readonly bootstrapSecretFile: string };

/** The filesystem locations a runtime uses below its state directory. */
export type StateLayout = Pick<
  RuntimeStack,
  'stateFolder' | 'logFile' | 'storageFolder' | 'sandboxesFolder' | 'projectFolder'
>;

/** The variables a restart stages over those the stack started with. */
export type RestartInput = { readonly variables: StackVariables };

/** A folder of built releases to publish, each file at its bucket key below it. */
export type PublishInput = { readonly folder: string };
