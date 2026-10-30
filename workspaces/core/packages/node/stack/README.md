# @mechane/stack

Mechane's local runtime uses celld, Docker, and the same Worker and Pi code as a hosted deployment. The packaged
`mechane-local` launcher retains agents, authentication, R2 objects, and sandbox files across restarts. Source
contributors can also run disposable fixtures with fake GitHub and a scripted model.

Layer 5 · node lane · effect dialect · consumers: distribution, testing, smoke

## Install locally

Download the `mechane-local-vVERSION-TARGET.tar.gz` archive and `SHA256SUMS` from the same
[public release](https://github.com/mechane-ai/mechane/releases). Targets are `darwin-arm64`, `linux-arm64`, and
`linux-x64`. Compare the archive's SHA-256 with its entry in `SHA256SUMS`, then extract it into an empty directory. The
archive includes the launcher, celld, the CLI, Worker, guest image, and license notices. Docker is the runtime
prerequisite; Node, mise, a source checkout, and compilers are unnecessary.

Start Docker, copy `model.example.json` to a private configuration file, and replace its API key:

```sh
cp model.example.json model.json
chmod 600 model.json
./mechane-local start --config model.json
```

The JSON file has three fields: `model_upstream`, `model_api_key`, and `model_offers`. The upstream must support
streaming OpenAI-compatible Chat Completions and tool calls. Its URL includes the API prefix, such as `/v1`, and
excludes `/chat/completions`. Only an explicitly selected file is read; its fields override the corresponding model
environment variables. Unknown fields and invalid offers are refused without printing their values.

The example uses OpenRouter's `anthropic/claude-haiku-5.5` with a 65,536-token context and 4,096-token output limit.
These smaller limits stay below the provider's higher-priced long-context range. Update the model ID, limits, and rates
when using another model. Rates are integer micro-dollars per million tokens; `$1` per million is `1000000`. Use `0` for
unused cache categories. The provider bills independently of Mechane's budget accounting.

The launcher verifies packaged checksums and loads the prebuilt Linux amd64 guest into Docker. ARM machines need a
Docker engine that runs amd64 containers. Celld also prepares its small network-fence image through Docker; its first
start can need network access. Product code is already built.

## Sign in and restart

The default origin is `http://127.0.0.1:8787`. State lives in `$XDG_STATE_HOME/mechane`, or `~/.local/state/mechane`.
`MECHANE_LOCAL_STATE_DIR` selects another absolute directory. `MECHANE_LOCAL_ORIGIN` selects another loopback origin;
each initialized directory keeps its origin so saved credentials remain bound to the same service.

Open the printed `/auth/local` URL and paste the contents of the printed bootstrap-secret file. Then run the bundled CLI
against that origin:

```sh
export MECHANE_ORIGIN=http://127.0.0.1:8787
./mechane auth login
```

Stop with Ctrl-C and restart with the same command and configuration. The private state directory retains credentials
and data after successful, failed, and interrupted runs. It permits only one running launcher or reset. To erase an
initialized installation explicitly, run `./mechane-local reset --confirm` while it is stopped.

The private state directory stores the encryption keyring, bootstrap secret, deployed credentials in `.dev.vars`, and
celld's databases. Preserve this directory when replacing the extracted release. Workspace credentials and integrations
use the runtime CLI; see [remote tools](../../../docs/remote-tools.md) and [Slack](../../../docs/slack.md).

A killed launcher can leave celld running. Its ownership record prevents restart or reset while those processes remain
alive. An interrupted startup with an unconfirmed owner requires checking its processes before removing that record; the
error identifies the file. The local web installer and CLI updates use the public release artifacts.

## Develop from source

Run repository setup and start Docker, then use `mise run start -- --config /absolute/path/model.json`. The same
configuration is also supported through `MECHANE_MODEL_UPSTREAM`, `MECHANE_MODEL_API_KEY`, and the JSON-array variable
`MECHANE_MODEL_OFFERS`. Source mode builds the Worker, guest, and locally served CLI. `mise run dev` starts a disposable
fixture with fake GitHub and a scripted model. `mise run local:reset -- --confirm` resets stopped source state.

## Public surface and layout

`loadStackSettings` reads configuration, and `startStack` starts a disposable stack in the caller's scope.
`LocalPackage` and `LocalTarget` define packaged runtime inputs consumed by distribution. `StackFailed` identifies
failed lifecycle steps. The line prefixes support the smoke's scripted model.

`src/local/` handles installed releases; `src/dev/` handles source commands. Both feed `src/project/`, `src/celld/`, and
`src/state/`. Local service fixtures live in `src/github/`, `src/host-launcher/`, and `src/model/`. The scripted
upstream is the first split seam if the package exceeds its budget.

Never serve the smoke's Worker a personal upstream, and never read environment variables outside
`load-stack-settings.ts`.
