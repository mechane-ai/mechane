# @mechane/guest

The guest program every machine of a sandbox runs, which runs each execution once, and the container image that carries
it.

Layer 6 · node lane · effect dialect · no consumers

## Layout

- `src/`: the program: its settings, the server that answers each request in a fiber of its own, and its exit.
- `src/executions/`: the executions resource: its route, the ledger of every execution by id, one run of bash in a
  process group of its own, and the receipt with its output excerpt and saved log.
- `src/workspace/`, `src/archives/` and `src/archive-files/`: asynchronous archive/restore jobs and bounded part IO.
- `src/quiescence/`: pauses writers before a container workspace snapshot and retains a final drain until shutdown.
- `image/`: the Dockerfile, installed `mechane` shim, and guest and CLI bundles that `mise run build:guest` writes
  beside it.

## Rules

The [product contracts](../../../.contracts/index.md) apply. The guest's wire, its paths and its variables are declared
once in `@mechane/sandbox-wire`, which the Worker's providers and the stack's host launcher read too.

## Use

`mise -C workspaces/core run build:guest` bundles `src/main.ts` into `image/guest.mjs` and the actual CLI into
`image/mechane.mjs`. The image installs `mechane` on `PATH` as a Node command that works on either supported image
architecture. This CLI build reports the protocol release and leaves binary self-update to the image owner. The guest
serves a `GET` of `/machines/<machine id>/health`, and a `PUT` of `/machines/<machine id>/executions/<execution id>`
that answers the execution's receipt. Workspace routes archive, transfer, restore and release a generation. The ledger
freezes new commands until release; a failed save can release the live workspace for a later cleanup command.

## Never

- Never restart a guest that has accepted an execution: its identity and receipt ledger remain single-use.
- Never read the environment outside `load-guest-settings.ts`. Execution children receive only `PATH`, their home, fixed
  execution variables, the current owner-authorized environment, and the public gateway certificate paths.

Container scope explicitly selects an isolated process namespace. Quiescence preserves the guest and its ancestor init
processes and stops other live processes of the guest user, including detached sessions. Failure to establish quiescence
fails the archive. Host fixtures explicitly select Process scope and do not claim container isolation. Archive scratch
files stay outside the home being saved. Raw and compressed byte limits are enforced while streaming, and restoration
validates part sizes and the whole archive checksum before replacing home contents.

Commands receive `MECHANE_CACHE_HOME` and tool-specific npm, pnpm, uv, pip, mise, and Go cache paths in machine scratch.
Mise installs pinned tools there again after replacement. Home files remain durable, including unknown generated files;
the archive applies no ignore rules. Size failures identify the tar or gzip representation, observed bytes, and bound.

Installation composition may supply a bounded public CA bundle through guest startup. The guest validates it and
combines it with Node's public roots and Cloudflare's interception CA when present. Each tool or bash child receives the
resulting scratch certificate bundle for Node, curl, git, and Nix, plus a Java-compatible trust store, including a
gateway CA injected after startup. Trust is never selected by model tool input, baked into an installation-independent
image, or replaced with disabled TLS verification.

Injected secret values are redacted before command output enters a receipt. A truncated tail also hides a possible
secret suffix. This prevents accidental disclosure; arbitrary authorized commands can still read their own environment.

Foreground Bash keeps a short receipt and up to 4 MiB of combined output in `.mechane-output` under the home directory.
Injected secrets are redacted before writing. A saved-log notice names its path and states whether any earlier bytes
were omitted. The newest 64 logs are retained through ordinary file checkpoints; user artifacts are untouched. The
command's exit remains factual when a log cannot be saved. Background process and archive diagnostic tails retain their
existing bounds.
