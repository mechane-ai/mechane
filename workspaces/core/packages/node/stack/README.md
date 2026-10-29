# @mechane/stack

Mechane's local runtime uses celld, Docker, and the same Worker and Pi code as a hosted deployment. `mise run start`
keeps agents, authentication, R2 objects, and sandbox files across restarts. `mise run dev` starts a disposable fixture
with fake GitHub and a scripted model.

Layer 4 · node lane · effect dialect · consumers: testing, smoke

## Start locally

Run the repository's setup first and start Docker. Use a model that supports streaming OpenAI-compatible Chat
Completions and tool calls. From the repository root, configure one model:

```sh
export MECHANE_MODEL_UPSTREAM='https://model-provider.example.invalid/v1'
export MECHANE_MODEL_API_KEY='replace-with-your-provider-api-key'
export MECHANE_MODEL_OFFERS='[
  {
    "id": "replace-with-your-model-id",
    "context_window_tokens": 32768,
    "max_output_tokens": 8192,
    "input_micros_per_million_tokens": 1000000,
    "output_micros_per_million_tokens": 5000000,
    "cache_read_micros_per_million_tokens": 1000000,
    "cache_write_micros_per_million_tokens": 1000000
  }
]'
```

Replace the URL, key, and model ID with your provider's values. The URL includes the API prefix, such as `/v1`, and
excludes `/chat/completions`. Replace both token limits and all four example rates with your model's values.

Keep `max_output_tokens` at or below `65536`. Rates are integer micro-dollars per million tokens: $1 per million is
`1000000`. Use `0` for cache categories your provider does not use.

These rates control Mechane's budget accounting; your provider bills independently. Keep the exports in your shell or a
private configuration file, then run:

```sh
mise run start
```

Normal local mode requires these settings and Docker containers. Optional integration settings use declared Worker
variables. The [deployment schema](../../shared/deployment/src/schemas.ts) defines additional validation.

The default origin is `http://127.0.0.1:8787`. State lives in `$XDG_STATE_HOME/mechane`, or `~/.local/state/mechane`.
`MECHANE_LOCAL_STATE_DIR` selects another absolute directory. `MECHANE_LOCAL_ORIGIN` selects another loopback origin;
each initialized directory keeps its origin so saved credentials remain bound to the same service.

The launcher prints the bootstrap secret's file path. Open `/auth/local` at the printed origin and paste that file's
contents. Then use the printed `MECHANE_ORIGIN` export and run `mise run mechane -- auth login`. The local installer
also serves a CLI built from this source; it does not bundle the local server.

Stop with Ctrl-C and restart with the same settings. The private state directory retains credentials and data after
successful, failed, and interrupted runs. It permits only one running stack or reset. To erase an initialized local
installation explicitly, run `mise run local:reset -- --confirm` while the stack is stopped.

The private state directory also stores the server's deployed credentials in `.dev.vars` and celld's deployment
database.

A killed launcher can leave celld running. The ownership record prevents restart or reset while those processes remain
alive. An interrupted startup with an unconfirmed owner requires checking its processes before removing the record; the
error identifies that file.

## Public surface

- `loadStackSettings` reads the stack's variables, and `startStack` starts a `Stack` in the caller's scope.
- `StackFailed` is the failure of a step of starting or stopping it, a member of its `StackStep`.
- `COMMAND_PREFIX`, `REPLY_PREFIX`, `HOLD_PREFIX` and `TOOL_CALL_PREFIX` start a scenario's scripted lines.

## Layout

- `src/state/`: disposable state, persistent state, its process lock, and explicit reset.
- `src/project/`: the Worker's project staged for celld, with the stack's variables.
- `src/services/`: the external-service fixtures used by disposable stacks.
- `src/celld/`: celld's process, its readiness and its restart.
- `src/loopback/`: the server every local service answers on.
- `src/github/`, `src/host-launcher/`, `src/model/`: the local services.
- `src/processes/`: a child's exit, and the stop of its process group.
- `src/releases/`: a release published into celld's object store, which `store/` writes as celld does.
- `src/dev/`: persistent start, explicit reset, and disposable fixture commands.
- `src/settings/`: decoding of local configuration and required model settings.

## Split seam

The stack is near its budget. The scripted model upstream, `src/model/`, splits out first: it reads only the loopback
server, the shared types and the line prefixes.

## Never

- Never serve the smoke's Worker a personal upstream: its mechs answer through the scripted upstream only.
- Never read the environment outside `load-stack-settings.ts`.
