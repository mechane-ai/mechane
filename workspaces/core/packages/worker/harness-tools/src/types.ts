import type { ToolRegistration } from '@earendil-works/pi-durable';
import type { ThreadState } from '@mechane/protocol';
import type { ExecutionProgress } from '@mechane/sandbox-wire';
import type { Duration, Option } from 'effect';
import type { HandsRefusal } from './schemas.ts';

/** How an execution of the mech's hands ended: as its sandbox settled it, or refused before it reached one. */
export type HandsOutcome = ExecutionOutcome | HandsRefusal;

/** Whom a conversation of the mech's Harness works for: the mech, or one of its drones. */
export type ConversationRole = MechRole | DroneRole;

/** A drone's conversation, by the provider session id it sends, which its drone bound before its first request. */
type DroneRole = { readonly _tag: 'Drone'; readonly sessionId: string };

/** A start_drone task's drone to start on a thread with its brief. */
export type DroneStart = { readonly taskId: number; readonly threadId: string; readonly brief: string };

/** How an execution ended, as the sandbox answers it: its progress, once it no longer runs. */
export type ExecutionOutcome = Exclude<ExecutionProgress, typeof ExecutionProgress.cases.Running.Type>;

/** The sandboxes of a mech and its drones as their tools reach them: one execution, run to its end; no pi type. */
export type Hands = { readonly run: (input: HandsExecution) => Promise<HandsOutcome> };

/** One execution for the sandbox of the conversation's mech or drone, under the id its tool call derives. */
export type HandsExecution = {
  readonly executionId: string;
  readonly role: ConversationRole;
  readonly command: string;
  readonly timeout: Duration.Duration;
  /**
   * The tool call's abort signal, none for a call pi gives none. A durable turn or drone cancel stops the command; a
   * routine harness handoff stops only the wait, so the next invocation can rejoin the command.
   */
  readonly signal: Option.Option<AbortSignal>;
};

/** The mech's own conversation, the root. */
type MechRole = { readonly _tag: 'Mech' };

/** A thread's new state, and its new note. */
export type ThreadChange = {
  readonly threadId: string;
  readonly state: ThreadState;
  /** The note that replaces what the thread says of where its work stands; none keeps the one it has. */
  readonly note: Option.Option<string>;
};

/** An open_thread task's thread to open with its title. */
export type ThreadOpening = { readonly taskId: number; readonly title: string };

/** What a tool call answers the model, as pi's tools resolve it: its output, whether it failed, and its diagnostics. */
export type ToolResult = Awaited<ReturnType<ToolRegistration['execute']>>;

/** What a tool answers for each outcome of a set, by its tag; a tool's table may spread a shared one among its own. */
export type OutcomeResults<O extends Readonly<Record<'_tag', string>>> = {
  readonly [T in O['_tag']]: (outcome: Extract<O, Readonly<Record<'_tag', T>>>) => ToolResult;
};

/** A failure the model reads: its code, beside pi's own, and what it says. */
export type DiagnosticInput = { readonly code: string; readonly message: string };

/** Why a tool's schema refused the model's arguments. */
export type IssueInput = { readonly issue: string };
