# @mechane/stack

The local stack runs the application Worker in celld, with verified TLS Postgres and a separate celld host for real
Docker guests. Both hosts load the same Worker entry and use the shared deployment descriptions. Application reloads
preserve the sandbox host, guest machines, and running commands.

Layer 5 · node lane · plain dialect · consumers: testing, smoke

## Develop

Install the repository's pinned tools and dependencies, start Docker, then run `mise run dev`. The launcher prints the
Console URL and `MECHANE_ORIGIN` for the CLI. Each worktree retains its own state under
`~/.local/state/mechane/dev/WORKTREE_HASH`, or `MECHANE_LOCAL_STATE_DIR`. The first start selects a free loopback origin
and retains it across restarts. `MECHANE_LOCAL_ORIGIN` can select an explicit loopback HTTP origin with a port.

In another terminal, use the retained installation directly:

```sh
mise run dev -- status
mise run dev -- cli --help
mise run dev -- test duplicateNotificationRunsAndChargesOnce
mise run dev -- apply sandbox
mise run dev -- apply guest
mise run dev -- stop
```

`cli` runs the source CLI against that installation. Fixture-only scenarios marked safe for retained state can reuse it;
other `test` cases run in an isolated stack. Neither result qualifies a release. Apply only the source owner being
changed. `sandbox` recompiles and applies the environment Worker; `guest` rebuilds and applies the developer image. Both
use an admission hold and real file drain before replacing their affected owner. Failed apply retains that hold, live
files, and hosts for recovery.

After rebuilding an installation-owned CLI, update its tool archive and descriptor, then use `apply guest`. That apply
reruns guest preparation and captures the new tool bytes before replacing the machine. `apply sandbox` does not rebuild
external CLIs, and editing their source alone does not update an already-running guest.

Status reports the application and sandbox process identities, compiled and applied bundle hashes, source mode, build
duration, guest image, and admission hold. The environment's compiled hash describes its existing bundle until explicit
apply recompiles it. Application reload is automatic; environment and guest apply are explicit. A same-byte restart
recovers an owner without claiming that source edits were applied.

Console development uses Vite HMR directly from Console and Elements source. It forwards API requests to the application
Worker, so startup needs no Console or Elements build. Esbuild watches the Worker's actual import graph, including
workspace packages, and publishes successful bundles before requesting an application restart. A failed compile leaves
the previous application available. Guest output, state, and logs stay outside that graph; celld's own watcher is off.
An application restart does not silently rebuild or replace the retained environment host.

Development defaults to deterministic external HTTP fixtures. GitHub sign-in offers owner, member, and rejected outsider
accounts; scripted model replies need no provider account. Select each provider independently at start, for example
`mise run dev -- start --model=live --github=fixture`, and supply the live provider's
[runtime](../../worker/runtime/src/config.ts) and [authentication](../../worker/server/src/settings/server.ts)
configuration to use configured providers. The launcher owns the local database, credential keyring, and bootstrap
workspace identity. `sandbox: 'configured'` requires an explicit authenticated sandbox origin and service credential.

Authentication keeps separate address and principal budgets. Public sign-in/device requests and failed credentials
consume the address allowance; verified bearer and browser-session API traffic consumes the principal allowance.
`MECHANE_AUTH_RATE_LIMITS` configures the existing ceilings. The smoke limiter scenario lowers its test admission limits
explicitly and verifies persistence, address isolation, and authenticated work on an exhausted anonymous address.

The supervisor requires pinned Node 24 and celld. `nodeExecutable` selects the checked Node executable. A qualification
can supply `celldBinary: { executable, version, sha256 }`; the launcher verifies and records its identity. A patched
binary has its own identity. The local durable wake scan uses the qualified 100 ms interval.

`runStackProgram` defaults to source compilation and the source CLI. Non-Console source scenarios need no built UI
assets; Console and full source runs use Vite. Exact-artifact acceptance explicitly selects `isSource: false` with its
Worker directory, assets, guest image, and built CLI. That mode copies the selected Worker bytes unchanged into celld
projects and does not compile or watch them.

## Lifecycle

`runDevelopment` in `src/dev` owns retained source sessions and their private control endpoint. `runStackProgram` owns
individual stack startup, signals, and cleanup. Its callback receives the stack and an interruption signal. `restart`
replaces only the application Worker; Postgres, external fixtures, and sandbox executions remain available. The sandbox
driver separately exposes host restart, exact owned container inspection, file fixture operations, and machine
destruction. `dumpStorage` reads Postgres and durable SQLite bytes for credential checks; keep its result out of logs.

Storage dumps include `MECHANE_DURABLE_STORAGE_FILE_V1` JSON lines with each SQLite or WAL file's source path, base64
bytes, and SHA-256, alongside searchable raw text. These preserve live file bytes for private diagnosis; concurrent
writes mean they are not a transaction-consistent database backup.

Failure paths capture private storage, owned host processes, Docker state and guest process status before destructive
scenario cleanup. Each capture records its boundary label and unavailable observations within a five-second deadline.
The runner retains a separate capture after scenario cleanup, with links to the earlier captures. Existing credential
checks still inspect the complete searchable storage dump. Remove these private diagnostic folders after review.

Native logs include the Worker's console messages through `cell_console=info`, because celld maps every JavaScript
console level to that native level. The supervisor preserves other `RUST_LOG` directives and any explicit `cell_console`
selection. It records the effective filter in its ownership file.

The browser origin stays loopback HTTP. Guest CLI calls use one owned HTTPS gateway to the application listener, with a
`host.docker.internal` certificate signed by the local development CA. Command gates register opaque routes on that same
gateway instead of opening additional host ports. Only the public CA enters guest startup trust.

Before starting the environment host, the stack declares the gateway's exact port in `CELLD_CONTAINER_HOST_SERVICES`.
The native Linux capability permits that bridge-gateway port while retaining the other guest and private-host fences.
Application restarts retain the gateway; shutdown closes it after the owned guests and environment host stop. Worker
authentication and opaque fixture routes authorize requests on this shared bridge capability.

Unconfirmed environment cleanup retains the gateway port, fixtures, database, and ownership records. An explicit Stop
retry reconciles the same environment state and immutable Worker before confirming cleanup and releasing the port.
Startup failures carry their owned cleanup callback; successful cleanup preserves the original startup failure. Docker
Desktop uses its host forwarding, and Linux port isolation requires its native qualification.

Postgres uses verified TLS with SCRAM authentication. The local sandbox explicitly uses direct Docker networking; hosted
gateway behavior requires its own qualification.

Local server certificates last 365 days. Reopening renews an expired or overlong leaf under the existing development CA,
preserving the CA, server key, and Postgres data.

Each stack records its owner, processes, logs, origins, and teardown in a private state directory. Docker resources
carry ownership labels. Worker `.celld/supervisor.json` records include celld's separate node process group, so teardown
also handles an application supervisor killed with `SIGKILL`. Per-process `.celld/exit-<pid>.json` receipts record the
requested and OS-reported exit signals. An environment-changing restart preserves its requested signal.

Persistent shutdown first reads authenticated sandbox ownership, requests Stop, and waits for completed receipts within
one deadline. A failed checkpoint keeps the hosts and files available, records recovery status, and permits a later
shutdown retry. Successful shutdown releases owned processes and containers while retaining database, durable object,
R2, keyring, and certificate files. Ephemeral fixture mode discards its owned state after stopping resources. Failed
startup retains private files for diagnosis. An ownership record prevents a second launcher from taking the same state.

After a successful shutdown, `mise run dev -- reset --confirm` deletes that local installation. The reset requires a
recognized state directory and refuses existing owner records, Worker locks, or owned Docker resources. It never stops
resources or bypasses failed shutdown recovery. Select a different `MECHANE_LOCAL_STATE_DIR` to keep existing data.

The public fixture and lifecycle types live in [types.ts](src/types.ts); the lower-level Worker launcher options live in
[celld/types.ts](src/celld/types.ts). External fixtures implement provider protocols. All Mechane operations use the
application Worker and its actual stores.
