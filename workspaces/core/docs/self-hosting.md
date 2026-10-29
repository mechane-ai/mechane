# Run your own Mechane

Mechane runs its Worker, Durable Objects and R2 buckets in your Cloudflare account. New installations use Cloudflare
Containers for guest machines. Local development uses the same guest with celld. Tensorlake remains an optional provider
for installations that already use it.

## Install from source

Clone [mechane-ai/mechane](https://github.com/mechane-ai/mechane) and follow the root README to install the pinned
tools. Run these commands from the repository root:

```sh
mise run setup
mise run check
```

The check uses scripted models and local runtimes. It renders the public Cloudflare example without credentials and does
not deploy or call a paid model. Use an annotated release tag whose version matches the source for deployment. The
deploy checks that the tag exists on `origin`, that it points to this checkout, and that `origin/main` contains it.

## Choose installation resources

Keep operator configuration outside the checkout so release checkouts stay clean:

```sh
mkdir -p "$HOME/.config/mechane"
cp workspaces/core/packages/worker/app/cloudflare.example.jsonc "$HOME/.config/mechane/cloudflare.jsonc"
export MECHANE_DEPLOY_CONFIG_FILE="$HOME/.config/mechane/cloudflare.jsonc"
```

Edit the copy before contacting your account:

- Choose a unique Worker `name`, the two R2 bucket names, and the container application `name`.
- Set `routes` and `MECHANE_ORIGIN` to your domain in Cloudflare. Both must describe the same installation.
- Register a GitHub OAuth application for that origin, with callback `/auth/github/callback`. Set its client ID in
  `MECHANE_GITHUB_CLIENT_ID` and keep its client secret outside the configuration.
- Set the HTTPS `MECHANE_MODEL_UPSTREAM` and `MECHANE_MODEL_OFFERS` for your compatible model provider. Supply its real
  model ID, token limits and rates; the example's offer is a placeholder.
- Set sandbox admission, machine limits, daily model allowances and rate limits for your users. The example admits every
  workspace through `MECHANE_SANDBOX_WORKSPACES: "*"`; a JSON array of workspace IDs restricts access.

The installation owns names and settings. The product owns Durable Object class names, bindings and append-only
migrations. Once deployed, keep the Worker and bucket names stable: changing them selects different stored data. The
renderer takes the guest Dockerfile from this release's source, resolves its path, and supplies it to Wrangler.

## Supply credentials

`secret_refs` maps Worker secret names to environment variable names. Values never belong in the installation file. For
the example, supply:

| Environment variable                  | Purpose                                                      |
| ------------------------------------- | ------------------------------------------------------------ |
| `CLOUDFLARE_ACCOUNT_ID`               | Your account ID                                              |
| `CLOUDFLARE_API_TOKEN`                | Worker, Containers and R2 deployment access for that account |
| `MECHANE_DEPLOY_GITHUB_CLIENT_SECRET` | Your GitHub OAuth application secret                         |
| `MECHANE_DEPLOY_MODEL_API_KEY`        | Your configured model provider's key                         |

Either export these from your secret manager or put them in a private dotenv file. To use a file:

```sh
chmod 600 "$HOME/.config/mechane/install.env"
export MECHANE_DEPLOY_ENV_FILE="$HOME/.config/mechane/install.env"
```

An explicit file supplies all credentials; the deploy does not mix missing values with shell credentials. Without that
file setting, it reads only the Cloudflare names and the references declared by this installation. Model keys have no
OpenRouter-specific format. Only a configured OpenRouter origin triggers the read-only credit-limit check. Other
providers receive no model request during preflight.

Optional remote-tool tokens use `MECHANE_INTEGRATION_SECRETS` as an additional `secret_refs` key. Its environment value
is the workspace-to-reference-to-token JSON map described by the integration configuration. Slack installation metadata
belongs in `MECHANE_SLACK_INSTALLATIONS`; its secret references resolve through that same private map. Cloud
configuration rejects the local bootstrap secret and host-launcher variables.

## Provision and inspect

Enable Workers, Containers and R2 in your Cloudflare account. Create the two buckets with your chosen names, using the
dashboard or an authenticated Wrangler session:

```sh
mise -C workspaces/core/packages/worker/app exec -- pnpm exec wrangler r2 bucket create my-mechane-releases
mise -C workspaces/core/packages/worker/app exec -- pnpm exec wrangler r2 bucket create my-mechane-workspace-files
```

These commands create resources and may incur account charges. Keep the workspace-files bucket private. Do not apply a
bucket lifecycle policy that deletes active workspace generations. No workspace archive is served by the Worker.

Render your configuration before deploying:

```sh
mise -C workspaces/core run deploy:render
```

Inspect the path printed by the renderer under `workspaces/core/packages/worker/app/.wrangler/installations/`. Each
Worker has its own folder and each configuration has a content-addressed file. It contains resource names, variables,
the release's guest Dockerfile and migrations. It contains no credential values or secret references. `--config PATH`
overrides `MECHANE_DEPLOY_CONFIG_FILE` on any deploy-program mode.

Start Docker, then run the read-only account checks from a clean release checkout:

```sh
mise -C workspaces/core run deploy:preflight
```

Preflight checks the clean annotated release, account access, both buckets, Docker, the rendered Worker, the currently
deployed release, and append-only migrations and API formats. It changes no cloud resource. The public example's
`.invalid` domain and model URL must be replaced before an installation can serve users.

## Deploy and operate

```sh
mise -C workspaces/core run deploy
```

The deploy runs the full local check and preflight, then asks for the exact release tag. It uploads the Worker and
configured secrets together from an owner-only temporary file, which is removed when the command ends. Existing Worker
secrets omitted from the file are preserved by Wrangler. No credential value goes in a command argument or deploy
diagnostic. [Cloudflare secret uploads](https://developers.cloudflare.com/workers/configuration/secrets/)

Wrangler builds and publishes the configured guest through Cloudflare's supported Dockerfile image path. Container
rollout follows Worker activation and is not atomic with it; readiness can pass before container provisioning finishes.
Treat a failed image build or rollout as an incomplete deployment and reconcile it before admitting work.
[Cloudflare container deployment](https://developers.cloudflare.com/containers/guides/deploy/)

The command checks readiness and served endpoints, publishes the CLI release into your releases bucket, and prints the
Worker version and bundle digest. Point the CLI at your installation before logging in:

```sh
export MECHANE_ORIGIN="https://agents.your-domain.example"
mise run mechane -- auth login
```

Upgrade from a new clean annotated release while retaining the installation's Worker and bucket names. The deploy
refuses changes to previously shipped migrations and API formats. Keep backups and retention under your account's
control; a source release is not a backup of Durable Object databases or R2 workspace files.

Rollback changes Worker traffic only:

```sh
mise -C workspaces/core run deploy:rollback -- --to WORKER_VERSION_ID
```

It requires the earlier version to have compatible stored formats and guest-image inputs. It never rolls back databases,
workspace files, images or CLI releases. Cloudflare refuses a version with incompatible secret changes; roll forward
with a patch release in that case.

## Existing Tensorlake installations

Set `MECHANE_SANDBOX_PROVIDER` to `tensorlake`, omit `container`, and supply `tensorlake_image_prefix` plus the
`MECHANE_TENSORLAKE_API_KEY` secret reference. Each release builds or reuses `<prefix>-v<release>` through Tensorlake.
The prefix preserves that installation's image namespace. New container installations need neither setting.

Sandbox provider selection is persisted. Changing the default affects new sandboxes; it does not move existing machines
or workspace files. Keep the Tensorlake image prefix and secret reference when existing Tensorlake sandboxes remain,
even if new sandboxes use Containers. A provider migration needs an explicit data transfer and cutover.
