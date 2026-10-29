---
name: code-environment-settings
message: Read a program's environment only in its settings module, decode it once there, and pass decoded settings to the code that needs them.
paths: ["**/*.ts"]
---

## Rules

A program's environment is the configuration its runtime or operator hands it rather than the data it processes: environment variables, process arguments, configuration files such as an installation file, and a server runtime's configuration and resource bindings.
Declare one settings module for each program, such as a server, a command-line tool, an eval runner, or a set of scripts that read one installation file, and read the program's environment only in that module.
A settings module may be a `settings` folder whose files each hold one role under `code-module-file-roles`.
A command model that declares a program's arguments and their environment fallbacks is part of the settings module, and it stays limited to declarations as `cli-command-reference-generation` requires.
Decode each environment value once, in the settings module, and return the decoded settings as one named type.
Declare each setting's default value once, in the settings module or its command model, never where the setting is used.
Pass the decoded settings, or the part a function needs, to that function as an input, and never pass the raw environment or a raw binding object beside them.
Never read a raw environment value outside the settings module, whether as a field of a binding object, such as `env.API_URL`, `this.env.API_URL`, or `context.env.API_URL`, by destructuring that object, or as a JSON string that another module parses.
The entry point that the runtime calls with the raw environment, such as an exported request handler or a long-lived object's constructor, may receive it and hand it to the settings module.
Read secret settings, such as a provider's API key, in the settings module too, even when the command model must not accept them as arguments.
List in the settings module every parent variable that a child process inherits; the code that starts the child may add values it computes for that child, such as a credential issued for one command, and a child that receives a setting decoded from a parent variable inherits that variable.
Enforce these rules with the repository's lint, which reports every environment read and every use of the raw environment type outside the settings module's declared paths.
Suppress a finding only as `code-lint-suppressions` allows, such as at the entry point that hands the raw environment to the settings module.

Violation: `const port = Number(process.env.PORT ?? '8080')` inside a request handler reads a setting and declares its default where the setting is used.
Allowed: the settings module decodes `PORT` with its default of 8080 into `settings.port`, and the handler receives `settings` as an input.

## Checks

Run the repository's lint from the repository root and confirm that it reports environment reads and raw environment types outside the settings module's declared paths.
For each function a change adds or edits, does it receive the raw environment or a binding object beside decoded settings?
Does the change declare a setting's default, or parse a setting's raw text, outside the settings module?
For each child process a change starts, does it inherit any parent variable that the settings module does not list, including by passing no environment at all?

## Local adaptations

Settings modules: the Worker's `packages/worker/bindings/src/settings`, the CLI's `packages/node/cli/src/settings` with its command model `packages/node/commands/src`, the guest's `packages/node/guest/src/load-guest-settings.ts`, `packages/node/release/src/load-release-settings.ts`, the release program's, `packages/node/deploy/src/load-deploy-settings.ts`, the deploy program's, `packages/node/deploy/src/image/load-image-settings.ts`, its image child's, and `packages/node/stack/src/load-stack-settings.ts` with its pure decoders in `packages/node/stack/src/settings`, which the persistent local, fixture and smoke programs share; the checks program reads no environment.
The CLI reads `MECHANE_API_KEY` and `XDG_CONFIG_HOME` in `load-invocation.ts`, beside its flags' variables, and the command model declares both for `--help`.
`load-invocation.ts` also reads the release stamp, which a release compiles in as `import.meta.mechaneStamp`, and `process.execPath`, the binary `mechane update` replaces.
The release program reads its mode from its one argument; Bun inherits `PATH` and `HOME`, and Wrangler also `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, which `MODE_VARIABLES` lists.
The Worker module hands its raw environment to `serve`, which hands it to `decodeSettings`; a Durable Object hands the environment its constructor receives to `objectSettings`, which decodes the model variables and the object bindings synchronously; the mech's object, which alone reads them, and the settings are the only code that names `WorkerEnvironment`.
`@mechane/deployment` declares the deployment's variable names once: `ORIGIN_VARIABLE`, which every client reads, and `WORKER_VARIABLES`, which the Worker decodes and the stack writes.
When neither `--origin` nor `MECHANE_ORIGIN` names a deployment, the CLI calls production's, `DEFAULT_ORIGIN` in its command model, which repeats the origin `packages/worker/app/wrangler.jsonc` gives the Worker; dev prints the stack's origin to export, and the smoke gives every CLI child it.
`packages/worker/app/wrangler.jsonc` holds the product's base configuration. The deploy settings read an explicit installation file, selected with `--config` or `MECHANE_DEPLOY_CONFIG_FILE`, which owns cloud resource names, routes, nonsecret Worker variables and secret references. Every cloud operation requires that selection; credential-free rendering alone defaults to `packages/worker/app/cloudflare.example.jsonc`. Fixture `.dev.vars` supplies the local GitHub client and scripted model upstream's URL, key and offers, and the smoke shortens a named key's lifetime there.
`loadStackSettings` reads every variable declared in `WORKER_VARIABLES` for persistent local mode; fixture and smoke startup ignore those operator values and use their declared fixtures.
It reads `MECHANE_LOCAL_STATE_DIR` for persistent state, defaulting to `mechane` below `XDG_STATE_HOME` or `~/.local/state`, and `MECHANE_LOCAL_ORIGIN`, defaulting to `http://127.0.0.1:8787`; fixtures use the operating system's temporary directory as their state root.
`loadStackSettings` reads `MECHANE_SANDBOX_PROVIDER` for persistent local mode, `container` when it is unset, and never falls back to `host`; the smoke always runs `host`, and the stack refuses `host` beside a person's model upstream.
The sandbox's object decodes `MECHANE_SANDBOX_PROVIDER` itself, with `MECHANE_HOST_LAUNCHER_ORIGIN` and `MECHANE_HOST_LAUNCHER_KEY` only under `host`, since only the local stack serves a launcher.
The guest reads `MECHANE_GUEST_MACHINE_ID`, `MECHANE_GUEST_HOST` and `MECHANE_GUEST_PORT`, which `GUEST_VARIABLES` names; every execution sees only `PATH`, `HOME` and `EXECUTION_VARIABLES`, never the guest's own.
A child of the stack inherits only `PATH`, `HOME` and `DOCKER_HOST`, which `INHERITED_VARIABLES` in `packages/node/stack/src/load-stack-settings.ts` lists, and a host machine only `PATH` beside its start's variables; celld also receives `CELLD_MAX_RSS_MB=0`, and the CLI child the stack's origin under `ORIGIN_VARIABLE` with the scenario's `XDG_CONFIG_HOME` and, where it presents a key, `MECHANE_API_KEY`.
oxlint `node/no-process-env` and `no-restricted-properties` on `process.argv` and `process.execPath`, with overrides for the settings modules, and ast-grep `raw-environment-type`, `raw-worker-environment` and `raw-binding-read` enforce these rules.
The operator's limits and lists are Worker variables that a deploy applies: `MECHANE_RATE_LIMITS`, a JSON object of each policy's `requests` and `window_seconds`; `MECHANE_SANDBOX_WORKSPACES`, a JSON list of workspace ids or `"*"`; `MECHANE_WORKSPACE_MACHINES`; and `MECHANE_SUSPENDED_WORKSPACES`, a JSON list of workspace ids. The installation declares each and decodes them with the Worker's schemas in `@mechane/deployment` and `@mechane/protocol`, so malformed values fail rendering before a cloud call.
`MECHANE_SANDBOX_EGRESS`, `fence` or `gateway`, decodes only under `container`; the cloud installation chooses its value, and the local stack stages `fence` for containers, since celld refuses the interception the gateway needs, and `*` as the sandbox list for both providers.
`Stack.restart` stages its `variables` over the stack's before celld starts again, as a deploy applies new values, so a scenario can change the operator's lists of a running stack.
The deploy loader reads its mode and flags, `MECHANE_DEPLOY_CONFIG_FILE` and optional `MECHANE_DEPLOY_ENV_FILE`; its settings helpers decode the invocation, installation and credentials from those explicit inputs. Credentials come from that file of mode 0600 when selected, otherwise from the parent environment: only `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and the names in the installation's `secret_refs` are used. Credentials are redacted before their shape is checked, so a refusal never quotes their values. Its children inherit `PATH`, `HOME` and `DOCKER_HOST`; git also `SSH_AUTH_SOCK`, and Wrangler the two Cloudflare names, `WRANGLER_LOG_PATH`, `WRANGLER_SEND_METRICS=false` and `--env-file /dev/null`, so no ignored dotenv file reaches its environment. The image child's settings module decodes its one image-name argument; the SDK receives `TENSORLAKE_API_KEY` in that child's environment.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- oxlint `node/no-process-env` (ST-31): enforced, `"error"`
- oxlint's restricted members (ST-31): enforced: `process.argv`, `process.execPath`
- oxlint's restricted members (ST-31): enforced: `node:process`, `process`
- ast-grep `raw-binding-read` (ST-31): enforced
- ast-grep `raw-environment-type` (ST-31): enforced
- ast-grep `raw-worker-environment` (ST-31): enforced

<!-- End of the generated block. -->
