# Run your own Mechane

Deploy the qualified Cloudflare application Worker with its Console assets, Mech and Sandbox Durable Objects, checkpoint
bucket, and container application. Pi owns durable agent execution inside each Mech actor. Standard Postgres owns shared
control data; PlanetScale is an optional hosted choice.

## Ownership

| Installation configuration                     | Runtime records                                                 |
| ---------------------------------------------- | --------------------------------------------------------------- |
| Worker version, domains, compute capacity      | Principals, workspaces, memberships, definitions                |
| Database roles and secret references           | Credentials, grants, spend and capacity reservations            |
| Guest image, checkpoint bucket, network policy | Durable conversations, notifications, publications and receipts |

Keep one OpenTofu declaration, state, and deployment writer per installation. Infrastructure applies preserve runtime
records. Configure workspaces and mechs through authenticated owner APIs after installing the application.

## Install

1. Select an immutable release and its independently pinned qualification SHA-256. Keep the complete candidate
   directory, including `qualification.json`, inputs, evidence, guest archive, and installation metadata. Follow the
   [artifact checks](operations.md#artifacts) before deployment.
2. Extract `mechane-cloudflare-vVERSION.zip`. It contains the installation module, compiled Worker, Console assets,
   notices, and database commands. Operators deploy these bytes without rebuilding application source.
3. Supply a TLS-verifying Postgres connection and distinct migration and runtime roles. Create the unprivileged runtime
   role before applying grants. Use the Node version recorded in `release.json` for the extracted database commands:

   ```sh
   node migrate.mjs
   node grant.mjs
   ```

   Both commands read `MECHANE_MIGRATION_DATABASE_URL`. The grant command also reads `MECHANE_RUNTIME_DATABASE_ROLE`.
   [Database settings](../packages/worker/server/src/settings/database.ts) define their current inputs.

4. Configure the extracted [Cloudflare module](../infrastructure/modules/cloudflare/README.md) with account, domain,
   settings, secret references, and `qualification.path` plus `qualification.sha256`. Preserve existing resource names
   during upgrades. The provider verifies qualification before uploading modules, Console assets, and the guest image.
5. Review and apply the infrastructure plan under the installation's writer. Require a subsequent empty plan, then check
   readiness, sign-in, actual Console assets, notification execution, and a cold sandbox command.

The application serves the API and Console through the `ASSETS` binding. Keep the HTTPS origin and GitHub callback
`/auth/github/callback` stable. The module also installs the bounded control-change delivery schedule.

`MECHANE_AUTH_RATE_LIMITS` sets address, device-start, principal, and code-attempt allowances. Authenticated API
requests use the principal allowance. Public authentication operations and failed authentication use the address
allowance.

## Secrets

Bind `MECHANE_DATABASE_URL` to the restricted runtime credential. Keep `MECHANE_MIGRATION_DATABASE_URL` in controlled
operator commands only. Serving code cannot write the migration ledger or retired execution tables.

Supply OAuth, model, credential-keyring, sandbox-service, and notification-producer secrets through deployment secret
references. Keep values out of HCL, provider state, manifests, logs, and browser assets. The module's
[variables](../infrastructure/modules/cloudflare/variables.tf) define settings and secret bindings.

Workspace credentials enter through authenticated write-only APIs. Retain earlier keyring versions while existing
ciphertexts or backups need them. Keep database backups, actor storage, workspace checkpoints, and required keys in the
same recovery plan.

## Local

Use the repository's pinned tools, the release-qualified celld build, and Docker for source development:

```sh
mise run setup
mise run dev
```

`dev` and `start` launch retained local state at `~/.local/state/mechane`, or `MECHANE_LOCAL_STATE_DIR`. The supervisor
starts a watched celld application, separate environment host, real Docker guest, TLS Postgres, and deterministic HTTP
fixtures. An application reload preserves the guest. The printed origin opens the Console.

An explicit `MECHANE_LOCAL_CELLD_BINARY` JSON override supplies `executable`, `version`, and `sha256`; startup checks
that identity. The [stack settings](../packages/node/stack/src/settings.ts) own local options. Local qualification does
not establish Cloudflare container parity.

## Use

Select the origin and sign in with an admitted identity:

```sh
export MECHANE_ORIGIN=https://agents.example.com
mechane auth login
mechane mech create --name scout
mechane notification send MECH_ID 'hello, scout' --notification-id REQUEST_UUID
```

Workspace owners configure membership, credentials, [execution access](agent-environments.md), and
[notification producers](notifications.md). Installation admission and workspace membership are separate grants. Use CLI
help and the [operation catalog](../packages/shared/protocol/src/catalog.ts) for current commands.

Read the [operations guide](operations.md) before upgrades. Moving preserved histories to actors requires positive
retirement of the previous execution owner and a reviewed, digest-bound import. Import preserves maintenance holds;
activation is a separate decision.
