---
name: code-domain-vocabulary
message: Name each domain concept with its one glossary word in code, output, documentation, and interface text, and never with a word it replaced.
paths: ["**/*.ts", "**/*.md", "**/*.json"]
---

## Rules

Apply these rules to identifiers, comments, command and log output, documentation, and user interface text.
Declare a glossary that gives each domain concept one word, states what the word means, and lists the words it replaced.
Keep the glossary in one place that reviewers read beside this contract, such as the copy's local adaptations or a contract that extends this one.

Name each glossary concept with its word, and give no second word to the same concept.
Never use a replaced word for the concept it was replaced for: after `invoice` replaces `bill`, an identifier, field, command, log line, heading, label, or comment that calls an invoice a bill violates this rule.
A replaced word keeps its ordinary sense, so a linked list keeps its `head` after `owner` replaces `head` for an account's owner.
Build compound names from glossary words, so an invoice's total is `invoiceTotal`, never `billTotal`.
Give a collection one name in every message, API, and output that carries it, such as `lineItems` for an invoice's lines everywhere, never `items` in one response and `lines` in another.

Configure the repository's lint to reject every identifier named exactly a replaced word that has no ordinary sense as an identifier.
Leave a replaced word that has an ordinary sense as an identifier, such as the `head` of a linked list or a regular expression's `match`, off that denylist, and check its uses in review.

## Checks

Run the repository's lint and confirm its identifier denylist holds every replaced word that has no ordinary sense as an identifier.
Search the governed files for each replaced word, including compounds, comments, and documentation, and confirm each match uses the word in its ordinary sense.
For each changed name, comment, message, or label, does a replaced word that the denylist leaves out stand for its glossary concept?
Does each concept a change introduces have a glossary word, and does each compound name the change adds use glossary words?

## Local adaptations

Glossary:

| Word | Meaning | Replaces |
| --- | --- | --- |
| operation | One kind of HTTP request the Worker serves, declared once in the catalog | endpoint, action, route (for the declaration) |
| catalog | The record of every operation, keyed by its name | registry, spec |
| error family | The closed set of failure kinds that fixes an HTTP status and an exit status | error category, error class |
| error code | A failure's stable tag on the wire; a client reads a code it does not know by its family | error id, error type |
| unknown member | A member of a closed set a response carries, or a record of a kind, that a newer deployment added and this release does not know; a client decodes it as text under the `UnknownMember` brand, or as its kind's unknown variant, such as `UnknownEvent`, and prints it as the wire wrote it | unrecognized value, future value, fallback |
| release | The Mechane version that a source tree builds, which the Worker, the CLI and its command reference report | build, version (for this concept) |
| worker revision | The commit a Worker was built from, marked dirty for uncommitted changes; the wire's `worker_revision` | source revision, build id, commit hash |
| schema revision | The count of migrations a Durable Object's database has applied | schema version, migration level |
| origin | The scheme, host and port of a deployment | base URL, endpoint, server URL |
| directory | The deployment's one `DirectoryObject` | registry, account store |
| limiter | A `LimiterObject` that counts the requests of one address, principal or GitHub user against each policy, in a stored window that opens at the first request after the last one ended | rate limiter, counter |
| window | One policy's count at a limiter: when it opened, at the first request after the last window ended, and the requests it took since | period, bucket (for a rate limit) |
| policy | One named rate limit, its requests per window: `address`, `device_start`, `principal` or `code_attempt`, set by `MECHANE_RATE_LIMITS` | rule, quota (for a rate limit) |
| stack | A local deployment: `celld dev` serving the staged Worker | environment (for this concept) |
| invocation | What one command line asks the CLI to do | request (for the CLI) |
| scenario | One function of the smoke that guards one consequential regression | test case |
| check | One named result a scenario reports | assertion, expectation (for a scenario's result) |
| owned check | One check of the repository's checks program, such as `boundaries` or `file-names`, which reports findings | custom lint, check (for this concept) |
| finding | One violation an owned check reports | error, issue (for this concept) |
| principal | The person a key acts for, which the first approval by a GitHub identity creates | user (for this concept) |
| identity | The external account a principal signs in with: a provider and its stable numeric id | login (for this concept) |
| key | The credential a request carries, a login key or a named key, stored only as its token's hash | access key, API token (for this concept) |
| key cache | The 256 `KeyCacheObject` shards, each named by two hex digits of a token's hash, that resolve a key and its principal's workspaces without the directory | key store, session cache |
| tombstone | A key cache row that holds only a revocation time, written before the directory revokes the key, which a fill never overwrites | revocation marker, deny entry |
| cached key | A key cache row that holds a key the directory resolved, with its principal and the principal's workspaces, which a tombstone outlives | cache entry, resolved key |
| token | The secret value of a key, a poll, a browser session or a sign-in | secret (for this concept) |
| device approval | A request for a key that the CLI starts and a signed-in browser session approves once it types the approval's user code | device login, device code |
| user code | The code the CLI prints and a person types on the device page after signing in; no URL carries it | device code, pairing code |
| peer | Where a request came from, as Cloudflare's edge reports it: the client's address, which the address policies count by, and its country; a device approval's review shows its start's | client, requester, origin (for this concept) |
| browser session | The deployment's own session of a browser that GitHub signed in, which only approves | web session, cookie session |
| sign-in | A GitHub OAuth web flow in progress, which ends in a browser session | OAuth transaction |
| saved login | The CLI's file holding its login key and the origin that issued it | session file, login file |
| workspace | A principal's space for mechs and model spend, with members | organization, team |
| listed workspace | A workspace that `MECHANE_SANDBOX_WORKSPACES` names, or every one under `*`; only a listed workspace's bash starts a machine | allowed workspace, allowlist entry |
| suspension | The operator's listing of a workspace in `MECHANE_SUSPENDED_WORKSPACES`: its members' calls answer `WorkspaceSuspended`, its dispatches see an allowance of 0, and it starts no machine | ban, block, disable |
| member | A principal that belongs to a workspace, whose key a workspace's operations admit | user (for this concept) |
| mech | An agent of a workspace, with a name, a model offer and instructions, that answers its inbox in turns | agent, bot, assistant |
| inbox item | One text sent to a mech, under an id its sender made, so a resend is received once | message, request (for this concept) |
| delivery | How an inbox item reaches its mech: `when_idle`, `next_pause`, which joins the running turn, `interrupt`, which cancels the running turn and then waits like `when_idle`, or `silent`, which enters the conversation without waking it | mode, priority (for this concept) |
| cancel | A member's decision, by `mechane turn cancel` or an `interrupt` item, that a running turn ends without a reply and saves none of its memory changes; pi's abort stays inside `harness` | abort, stop, kill (for a turn) |
| turn note | The message the alarm writes into a mech's conversation after a canceled or faulted turn, which also restarts the items queued behind it | cancel note, notice |
| memory | One text a mech keeps under a path, whose first line summarizes it, which outlasts restarts and resets of its conversation | note, fact, file (for this concept) |
| memory change | One write or deletion by a memory tool call, pending until its turn ends, then saved with a version or discarded | edit, mutation |
| memory version | A saved change's number, dense from 1 per mech in the order the mech's turns saved them | revision (for this concept) |
| digest | The SHA-256 in lowercase hex of a memory's text, which a replacement or a deletion names, or of an eval plan's basis, which its trials' ids derive from | hash, checksum, etag (for a memory or a plan) |
| memory section | The part of a mech's prompt that lists its saved memories, rendered again before each request | memory prompt, memory index |
| handoff | The mech's tool that resets its own context to a handoff note | reset (for the tool), context clear |
| handoff note | The text a handoff passes, which the mech's next context starts from | summary (for this concept) |
| turn | One run of a mech over the inbox items it took up, which ends with a reply or a reason for none | run, session, step |
| thread | A mech's own record of one piece of ongoing work: a title, a state and a note, open until it is resolved | task, ticket, topic |
| thread state | Where a thread is, as its mech sets it: `working`, `waiting`, `idle` or `resolved` | thread status, phase |
| drone | A fresh agent a mech starts on a thread, in its own conversation and sandbox, which ends once with a report or a reason for none | subagent, worker, child |
| brief | What a mech tells a drone to do, which the drone's conversation receives as its first message | prompt, task (for this concept) |
| report | A drone's final reply, which reaches its mech as an inbox item sent by the drone | result, summary (for this concept) |
| memory snapshot | The memory a drone reads: its mech's saved memory through the newest version saved when the drone started | memory copy, fork (for this concept) |
| reply | The text a turn answers with | response, completion |
| event | One entry of a mech's log, which `mechane event list` reads in order | notification, message (for this concept) |
| trace | One turn with each dispatch it made | log, span tree |
| log line | One JSON line the Worker writes through `writeLog`, an event of `LogLine` whose fields are ids, codes, integers and statuses, never a text a person or a model wrote | log message, log entry |
| harness | pi's durable agent runtime in a mech's object, which `packages/worker/harness/src` wraps | engine, runtime (for this concept) |
| model upstream | The chat-completions service a deployment sends dispatches to, such as OpenRouter or the stack's scripted upstream | provider, LLM endpoint |
| model offer | A model a deployment sells, with its context window, output cap and rates in micro-dollars per million tokens | plan, model (for the price list) |
| dispatch | One model request of a turn or a drone, reserved against the allowance before it is sent, or refused unsent | model call, completion, LLM call |
| work | The turn or drone a dispatch counts against, whose id the ledger stores with it | owner, source (for a dispatch) |
| end user | The workspace a dispatch is sent for, whose id rides as the request's `user` | customer, user (for the model upstream) |
| allowance | What a workspace's dispatches may cost in one UTC day, in micro-dollars | budget, quota, limit (for this concept) |
| cap | What one mech's dispatches may cost in one UTC day within its workspace's allowance, in micro-dollars | budget, quota, limit (for this concept) |
| reservation | The most a dispatch can cost, which it holds against the allowance until it settles | hold, budget (for this concept) |
| settlement | A dispatch's one charge: priced from the usage the upstream reported, or at its reservation without any | billing, payment |
| sandbox | A mech's or a drone's own `SandboxObject` and the machines it starts, where its bash tool runs | box, VM (for this concept) |
| hands | The sandboxes of a mech and its drones as the harness's tools reach them: one execution, run to its end, with no pi type crossing | executor, tool backend |
| machine | One start of a sandbox's guest under a fresh id: a container, or locally a host process; a new one starts with an empty home | instance, container (for one start) |
| lease | A workspace's record that one sandbox may run a machine until the idle window ends, renewed by each ask and released by a drone's stop; `MECHANE_WORKSPACE_MACHINES` bounds the unexpired ones | slot, quota (for this concept) |
| fence | celld's rules that let a container reach the internet but not the node or a private, shared or link-local range; `MECHANE_SANDBOX_EGRESS=fence` | firewall, egress filter |
| sandbox egress policy | Tensorlake allows package-source hosts and denies private networks; the local celld fence refuses private addresses and the deployment | — |
| guest | The program every machine runs, which runs each execution once and keeps its receipt | agent, daemon, server (for this concept) |
| execution | One bash command a sandbox runs once, under the id its tool call derives | job, run, sandbox command |
| receipt | An execution's settled result: its exit code or timeout, its duration and the tail of its output | execution result |
| host launcher | The stack's loopback service that starts and stops host machines for the Worker | process manager, spawner |
| launcher key | The token the stack's Worker presents to the host launcher, fresh for each stack | launcher secret, launcher token |
| target | A system and processor a release compiles the CLI for, named `<platform>-<arch>`, such as `linux-x64` | platform, architecture (for this concept) |
| release stamp | The release and target a release compiles into each CLI binary, which a run from source lacks | build info, version stamp |
| release manifest | A release's `manifest.json`: its release, the worker revision of the clean tree it was built from, and each target's binary with its key, SHA-256 and size; `cli/latest.json` repeats the latest one's | release index, version file |
| releases bucket | The R2 bucket bound as `RELEASES`, which holds each release file at its key and which the Worker serves read-only | artifact store, CDN |
| install script | The `install.sh` a deployment serves with its own origin, which installs the binary its latest manifest names | installer, bootstrap script |
| suite | The JSON file `mechane eval run` measures a mech with: its cases, the subject's and grader's settings, the repeats and each trial's cap | eval set, dataset, benchmark |
| case | One input of a suite for the subject, with the expectations its reply is graded against | example, sample (for this concept) |
| expectation | One thing a case's reply should do, which only its grader sees and judges as one criterion | rubric item, requirement |
| trial | One run of one case: a fresh subject mech's turn and, after a reply, a fresh grader mech's, whose id the plan's digest, the case and the repeat derive | attempt, sample (for this concept) |
| grade | A grader's reply that decodes as one JSON object with a summary and one criterion per expectation, each `pass`, `fail` or `uncertain` with its evidence; any other reply is `no_grade` | judgment, rating, assessment |
| subject | A trial's fresh mech with the suite's subject settings, which receives its case's input alone | candidate, model under test |
| grader | A trial's fresh mech with fixed instructions, which judges the subject's reply against the case's expectations | judge, evaluator |
| plan | An eval run's `plan.json`: its suite, release, worker revision and workspace, their digest, and each trial's id; a rerun runs only a plan with the same digest | run config, schedule |
| intent | A trial's record of a role's turn about to be sent, its mech and inbox item, saved before the send, so a rerun sends that item again under its id, which the deployment receives once | pending send, marker |
| lock | An out folder's `lock.json`, which names the process whose eval run writes the folder, so one run at a time does | mutex, pid file |
| self-grading | A suite whose grader may run on the subject's model, which it declares with `self_grading` | self-evaluation, same-model grading |
| verdict | How a grade judges one expectation, `pass`, `fail` or `uncertain`, and a trial's in the report: its grade's worst, or `no_grade`, `unavailable` or `run_failed` | result, score, status (for a trial) |
| fork | A new mech that begins with a whole copy of an idle mech's life, under a new id and name, with a provider identity of its own and an empty sandbox; also the act of making one | clone, duplicate, copy (for the mech) |
| parent | The mech a fork was copied from, which the fork's `forked_from` names | source, origin, ancestor |
| fork point | The parent and the sequence of its last event at the fork; the fork's log holds the parent's events up to it | branch point, snapshot |
| copy | The move of a fork's rows from its parent's object into the new mech's, in bounded pages, before pi opens on them | export, import, migration (for this concept) |
| overlay | An explicit cloud installation file: its resource names, routes, nonsecret variables and secret references, which only the deploy program reads; `packages/worker/app/cloudflare.example.jsonc` is the public example | production config, override |
| rendered configuration | The Wrangler configuration the deploy program writes from the base, the overlay, the smoke's bundle and the revision, and deploys | generated config, final config |
| preflight | The deploy program's ordered checks that this tagged, clean checkout and the operator's accounts can deploy production; it changes nothing | pre-deploy checks, validation |
| live release verification | The deploy program's run against production with the installed CLI and a real model, which runs only when a maintainer asks | canary, live test |

oxlint `id-denylist` rejects `endpoint`, a replaced single word with no ordinary sense as an identifier; review checks the rest.
The banned-words ratchet of `mise -C workspaces/core run checks` holds each replaced item of two or more words that no concept scope narrows, in any case style and inside compound names: in identifiers, strings that spell a snake-case or kebab-case name such as a wire key, the folders and stems of TypeScript paths, comments, `reference.json`, the wire lock's names, every contract's local adaptations and the whole of a contract without any.
It skips the glossary's last column and bans no replaced single word and no scoped item.
The key row scopes `API token` to its concept, since Cloudflare's own credential, `CLOUDFLARE_API_TOKEN`, which the deploy program names `cloudflareApiToken`, is an API token in Cloudflare's sense and no Mechane key.
History words, banned in names only, are `historyWords`. The same ratchet holds them in identifiers, name strings, path folders and stems, and the wire lock, never in prose.
A name that keeps an external system's own words, listed in 029's `externalNames`, such as oxlint's `new-cap` and its option `capIsNew` or Wrangler's migration key `new_sqlite_classes`, holds no banned item or history word, since Mechane did not choose it.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

Values: `historyWords` `old`, `new`, `legacy`, `deprecated`, `v2`, `temp`.
- owned check `banned-words` (NM-02): a ratchet until phase F1

<!-- End of the generated block. -->
