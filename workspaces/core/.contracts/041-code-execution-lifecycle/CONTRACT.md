---
name: code-execution-lifecycle
message: Bound work and preserve authoritative results through failure and interruption.
paths: ["**/*.ts"]
---

## Rules

Give concurrency, deadlines, retries, cancellation, and cleanup explicit owners.
Bound paid and external work across nested operations; give each request exactly one retry owner so that retry layers cannot multiply the intended budget.
Retry known transient failures within that budget, not valid unfavorable results.

Preserve completed work and visible failure states when resuming durable operations.
Define which steps and external effects can repeat after interruption.
Durably record a required external effect's intent and a stable operation identity before starting it, and reconcile an interrupted effect through that identity.
Reject reuse of an operation identity with different inputs.
Never automatically replay an external effect whose outcome is uncertain unless the external system deduplicates it by its operation identity; otherwise reconcile it with that system or surface it for a decision.
When an external system cannot check a precondition and apply an effect atomically, reconcile after the effect and state the remaining race.
Do not claim exactly-once effects without a supporting mechanism.
Surface failures to save authoritative results; never claim work was retained when persistence failed.

A task with external resources must have a cleanup path, owned by its lifecycle, that still runs when its caller fails.
Do not treat cleanup as proof that an external effect was rolled back; keep the effect's record until it is reconciled.

Derive reports and terminal displays from authoritative execution state.
Cosmetic progress and optional diagnostics must not decide success.
Record meaningful transitions and failures at boundaries using consistent identities and bounded, redacted diagnostics; avoid repeated logging through every helper.

## Checks

Trace success, failure, and cancellation through the affected owner.
Check the total request budget, retained results, and resource cleanup, including delegated work.
For recovery changes, exercise the relevant interruption or restart path and inspect saved state.
Interrupt an external effect after its intent is recorded and before its outcome is confirmed, and confirm that recovery reconciles it without applying the effect twice.
Submit a reused operation identity with different inputs and confirm that it is rejected.
Run the existing lifecycle tests; a passing type check does not establish recovery.

## Local adaptations

`packages/node/stack/src` owns the celld lifecycle through an Effect scope: startup waits at most 90 seconds for the health routes, 10 minutes when sandboxes run as containers, whose first start builds images, and fails at once when celld exits, quoting the end of its log, and shutdown sends SIGTERM to celld's process group and SIGKILL after 40 seconds, except that a passing run, which removes the state directory, kills the group at once, since celld's SIGTERM stop waits for each pending 20-second wait for an event.
`Stack.restart` kills celld's process group with SIGKILL, as a crash would, and starts celld again on the same state in the stack's scope; the killed group's own release then does nothing.
`interruptOnSignal` in `packages/node/program/src` makes SIGINT, SIGTERM and SIGHUP interrupt dev, smoke and guest work. It keeps its handlers until scoped finalizers finish, so repeated signals cannot cut cleanup short.
A failed run keeps its state directory without the files that hold the staged variables, and names its celld log, so the log and the objects' databases stay readable; a passing or interrupted run removes it.
Deadlines: a CLI call waits 30 seconds for the deployment's whole answer, the smoke gives each CLI run 60 seconds, and `git describe` gets 10 seconds. Release and distribution builders pass explicit build deadlines through `@mechane/program`. `startProcess` fails a child that outlives its deadline and kills a child that outlives its scope.
A device approval expires after 10 minutes, and the CLI polls it at the interval the deployment names, 2 seconds in `packages/worker/app/wrangler.jsonc` and none on the smoke's stack, polls again after a poll that no server answered or that met an unavailable deployment, since a key is delivered at most once, and stops waiting at its expiry; the Worker gives each call to GitHub 10 seconds.
The local GitHub, the scripted model upstream and the host launcher listen on loopback ports of the stack's scope, which closes them with celld; closing the launcher stops each host machine's process group as celld's is stopped.
A list of events waits at most 20 seconds, `WAIT_MAX`, for an event after its cursor, below the CLI's 30-second call deadline; `mechane event list --follow` repeats it, never retries a failed page, and resumes with `--after` the last sequence it wrote.
pi's 5 minutes bound only the wait for a dispatch's answer to start; celld's 330-second bound on an outbound request, which the stack sets, ends a stream locally, and nothing bounds one on Cloudflare, so an alarm's hand-off cuts a longer one; pi's durable retry is the one retry owner: the metered provider sends with no retry of its own, and each attempt is a dispatch of its own, reserved and charged.
A dispatch the upstream answers without usage, such as with an error status, settles at its whole reservation, so an outage can spend several bounds in one turn before pi stops retrying, and a turn the allowance then refuses ends `allowance_exhausted`.
pi parks a task that resets or crashes cut off five times in a row; every open marks each task pi's stored tasks show parked as aborted, so the alarm ends it before pi works and the items behind it get their turns: a parked model request ends its turn `faulted`, and a parked tool call tells the model it was aborted.
A dispatch that a lost instance cut off is sent again by pi as a new dispatch and charged again, since both reached the upstream; a reservation whose settlement was lost holds its day's allowance until the mech's object next opens and settles it at its reservation.
Only a mech's alarm lets pi work, because pi's work outlives the call that starts it, and celld refuses a transaction from an event that has ended.
A send records its item and then arms the alarm for now; the alarm delivers the items pi lacks and lets pi work until nothing can run or `MECHANE_ALARM_WORK_SECONDS`, 600, pass; it then holds new dispatches, waits up to 3 minutes for the open ones to settle and closes pi, which counts no restart and rejoins each command, and opens pi again, which arms the next alarm for now, since Cloudflare ends an alarm at 15 minutes.
Once nothing can run, the alarm arms itself for pi's earliest sleep or clears itself, and only then reads the items again, so an item a later send records has that send's alarm.
pi arms no timer for a sleep and announces nothing when one comes due, so while other work runs, the alarm's wait resumes pi at its earliest sleep's time itself: a model retry's backoff beside a drone's long command waits its backoff, not the command, as `agents` 0.30.1 fixed in its own `PiHarness`.
The alarm arms itself 60 seconds ahead before any work, and an open arms a fallback alarm before anything can fail, so an eviction, a reset or a failed open resumes the mech.
The alarm also delivers, every 250 ms while pi works and from its own timer, the items sends recorded meanwhile, so an item for the next pause reaches the running turn and no delivery runs in a send's event.
An execution runs once: the sandbox's object stores each intent before its effect, a machine's row before its start and an execution's dispatch before its request, answers a known id from its receipt, and never sends an uncertain execution again.
A machine has 90 seconds from its start to answer its health, which a call asks every 500 ms within its wait; past that it is stopped, and the executions claimed by then become unavailable, while a later one starts a new machine.
An execution runs for its timeout, 120 seconds unless the model names one up to 600, and a call waits at most 20 seconds for it before it answers that it still runs; the mech's hands ask again with no deadline of their own.
An execution's one deadline is its dispatch plus its timeout plus 30 seconds: past it, a guest that answers `running` or does not answer stops its machine, and the execution is uncertain.
Every call moves the sandbox's alarm 15 minutes past it, so the alarm stops a machine after 15 minutes without a command on both providers, and each start and call sets the container's inactivity timeout to a lease, 16 minutes, since Cloudflare otherwise stops a container shortly after its object goes inactive; the machine's end is recorded before its stop, and the next command starts a new machine. The alarm arms its retry a minute ahead before each stop and clears it once the stop returns, so a stop that keeps failing is tried each minute after the platform's six retries of the alarm, which would otherwise abandon it and leave the machine running.
A machine the platform stopped ends at the next call, which makes its dispatched executions uncertain.
The guest runs each execution in its own process group, kills the group at exit or timeout and every group on SIGTERM, and never restarts under the same receipt identity.
Container workspaces save `/home/node` to R2 before committing a completed command's receipt. A replacement restores the committed generation before accepting work; unfinished writes have no durability guarantee. A failed checkpoint preserves the live machine and its previous committed head.
Container quiescence also stops detached command processes before checkpointing. Background processes have no persistence guarantee. Optional Tensorlake machines retain their native home across suspension and guest replacement; an explicit image upgrade copies that home before retiring the source.
Cloudflare installs its outbound interceptors before each container start and starts with direct internet access disabled. A failed registration starts no machine. An already-running machine retains its startup network setting, so a network-policy rollout drains and recreates it through the existing checkpoint lifecycle, never by destroying it during object construction.
A cancel or an interrupt item's receipt only records the cancel and arms the alarm for now; the alarm, at its start or its next 250 ms poll, aborts the generation that holds the canceled turn's run and waits for it until none holds it, then writes the turn's note, and applies every owed note before any delivery.
The projection alone ends a canceled turn, once pi reports its run's end, and pi ends a run only after each tool call of its round returned, so a memory change awaited inside a call lands before the transaction that discards it; nothing checks the abort signal.
An aborted or faulted run keeps the items queued behind it, and the turn's note, a model-visible write, restarts that queue; a turn's unanswered end marks the alarm's next 250 ms poll, so the note is written even while drones work, and a poll that applied a note or a delivery makes the drive work again, since pi may restart just as the work it waited on ended.
The mech's hands stop waiting for a sandbox's answer when the tool call is aborted, and the execution runs on in its machine to its own end or timeout.
The protocol refuses bash text that no process can start with, a NUL character or more than 65,536 bytes of UTF-8, and a guest whose spawn the system refuses, or whose fibers meet any defect, writes why and ends, so its machine is lost at once instead of holding an execution that never settles.
`mechane update` reads `cli/latest.json` within the CLI's 30-second deadline and gives a binary's download 10 minutes; the release program gives Bun 3 minutes for each target and Wrangler 5 minutes for each file.
The release program uploads each release's binaries, then its manifest, then `cli/latest.json`, and the stack publishes in the same order, so a published manifest means its binaries are, and a publish that stops midway leaves the latest release as it was; `install.sh` and `mechane update` rename a checked binary into place, so a failed one leaves the installed binary as it was.
`mechane eval run` runs its trials one after another, each role on a fresh mech whose cap is the suite's `trial_cap_micros`, so the ledger bounds each turn's spend, and its plan refuses before any mech exists when the turns it has yet to send could, each at that cap, spend more than the day's allowance has left.
It saves each role's intent, the mech and the inbox item's id, before the send, and a rerun with the same out folder sends a role whose intent it holds without its record again under the intent's id, which the deployment receives once, so the turn runs at most once and the rerun saves it; the plan counts such a turn at its cap, since it may not have reached the deployment.
A role waits for its turn's end through the mech's events with no deadline of its own, since the turn's dispatches have theirs; the first Ctrl-C interrupts the run once the record it is writing is whole, and the run ends 130, while a second one ends the process at once.
oxlint `no-void` with `allowAsStatement` lets `void` stand only as a statement, where it marks a promise left floating on purpose.
Only `@mechane/utilities` builds, races or times a promise the Worker's members wait on (DO-05): ast-grep `promise-building` rejects `Promise.withResolvers`, `Promise.race`, `Promise.any`, `setTimeout`, `setInterval`, and a `.then` that lacks either handler or holds a promise rather than a call, in `packages/worker`, so a signal's waiters or a drain's are a `wakeList`, the alarm's hand-off and a tool call's abort an `untilAborted`, and a cleanup at a promise's end an `afterSettling` or `afterFailing`.
oxlint `promise/avoid-new` lets only a utility build a promise, such as `waitFor`, and `promise/always-return` with `ignoreLastCallback` has each `.then` handler but the last call's return a value.
oxlint `typescript/require-await` is off by decision: DO-03 bans `Promise.resolve`, so an `async` arrow that awaits nothing is how a callback a dependency types as answering a promise answers a value, such as a tool's `execute` or an auth's `resolve`; `typescript/promise-function-async` requires every promise-answering method to use `async`.
oxlint `promise/valid-params` and `unicorn/prefer-top-level-await` are off by decision, since both read Effect's `catch` as a promise's, the data-first `Effect.catch(self, handler)` and an `Effect.fn`'s trailing `Effect.catch` at module level: the compiler checks each promise method's arguments, and ast-grep `promise-chain` keeps every promise awaited rather than chained.
oxlint `typescript/return-await` with `always` has an async function await each promise it returns, so a rejection surfaces in the function that returned it.
Waits and retries are bounded one way: oxlint `no-restricted-properties` rejects `Effect.timeout`, `timeoutFail` and `repeat`, so a lapse that fails is `Effect.timeoutOrElse`, an ordinary lapse `Effect.timeoutOption`, and a known transient failure `Effect.retry` inside one deadline with one retry owner.
ast-grep `process-signal` keeps every `process` listener in `interruptOnSignal` (EF-11), so no other code races it for a signal; its two suppressions are the eval's own Ctrl-C handler, which `mechane eval run` needs because the CLI runs no `interruptOnSignal`, and which takes only the first signal, so a second ends the process at once.
ast-grep `fetch-signal` ratchets a `fetch` inside `Effect.tryPromise` that does not pass the wrap's signal, which an interrupt aborts.
A scope owns every resource, which `Effect.acquireRelease` acquires in an `Effect.fn` that `Effect.scoped` closes: oxlint `no-restricted-properties` ratchets `Effect.acquireUseRelease`, `addFinalizer` and `ensuring`, and `Scope.make`, `provide` and `close`. The override of `packages/node/stack/src/celld/start-celld.ts` allows `Scope.provide`, with which `Stack.restart` starts celld again in the stack's scope.
Every `Effect.forEach` and `Effect.all` states its concurrency: ast-grep `for-each-concurrency` and `for-each-options-concurrency` reject each `Effect.forEach` that does not, `all-concurrency` and `all-options-concurrency` each `Effect.all` that does not, and each rule's fix writes the default, `concurrency: 1`, which changes no behavior, as the last option, without a doubled comma.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- oxlint `typescript/no-floating-promises` (041): enforced, `"error"`
- oxlint `no-void` (041): enforced in phase D, `["error",{"allowAsStatement":true}]`
- oxlint's restricted members (EF-06): a ratchet until phase F3: `Effect.promise`
- oxlint's restricted members (EF-08): enforced in phase F3: `Effect.acquireUseRelease`, `Effect.addFinalizer`, `Effect.ensuring`, `Scope.make`
- oxlint's restricted members (EF-08): enforced in phase F3: `Scope.provide`
- oxlint's restricted members (EF-08): enforced in phase F3: `Scope.close`
- oxlint's restricted members (EF-09): enforced in phase A: `Effect.timeout`, `Effect.timeoutFail`, `Effect.repeat`
- oxlint `typescript/promise-function-async` (DO-03): enforced in phase F4, `["error",{"checkArrowFunctions":false}]`
- oxlint `typescript/return-await` (DO-03): enforced in phase D, `["error","always"]`
- oxlint `promise/avoid-new` (DO-03): enforced in phase D, `"error"`
- oxlint `promise/always-return` (DO-03): enforced in phase D, `["error",{"ignoreLastCallback":true}]`
- ast-grep `promise-chain` (DO-03): enforced in phase F4
- ast-grep `promise-building` (DO-05): enforced in phase F4
- ast-grep `fetch-signal` (EF-06): enforced in phase F3
- ast-grep `process-signal` (EF-11): enforced in phase F3
- ast-grep `all-concurrency` (EF-10): enforced in phase D
- ast-grep `all-options-concurrency` (EF-10): enforced in phase C1
- ast-grep `for-each-concurrency` (EF-10): enforced in phase D
- ast-grep `for-each-options-concurrency` (EF-10): enforced in phase D

<!-- End of the generated block. -->
