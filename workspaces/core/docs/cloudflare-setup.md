# Install on Cloudflare

Deploy Mechane with OpenTofu 1.13 or later, below 2.0. Use the published module and provider; installation needs no
source checkout, Node installation, or Docker daemon. The setup commands below work on macOS and Linux, on amd64 or
arm64, with `curl`, GnuPG 2, and OpenSSL installed.

## Account

1. Choose a Cloudflare account with [Workers Paid and Containers](https://developers.cloudflare.com/containers/), R2,
   and Secrets Store enabled. Record the account ID. Choose an unused hostname in an active zone in that account and
   record its zone ID.
2. Create a [GitHub OAuth app](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app).
   Set its homepage to your origin, such as `https://agents.example.com`, and its callback to
   `https://agents.example.com/auth/github/callback`. Record its client ID and retain its client secret privately.
3. Find each administrator's numeric GitHub user ID in `https://api.github.com/users/USERNAME`. Put the numeric `id`, as
   a string, in both `administrators` and `allowed_identities`. The example admits only that identity.
4. Create a custom Cloudflare API token with these permissions. Limit account permissions to the installation account
   and zone permissions to the zone containing your hostname and aliases.

| Scope                             | Permission                 | Used for                                  |
| --------------------------------- | -------------------------- | ----------------------------------------- |
| Selected account, Workers product | Workers Admin              | Create and manage the Worker              |
| Selected account                  | Workers R2 Storage Edit    | Create and manage the workspace bucket    |
| Selected account                  | Containers Edit            | Manage container applications and images  |
| Selected account                  | Account Secrets Store Edit | Bind the three existing secrets           |
| Selected zone                     | Workers Routes Edit        | Attach, update, and remove custom domains |

Cloudflare's current [Workers authorization guide](https://developers.cloudflare.com/workers/authorization/workers/)
requires product-level **Workers Admin** to create a Worker. `Workers Scripts Edit` maps to Editor, which manages
existing Workers. Custom domains also require **Workers Routes Write** on every affected zone. The token editor and
[permission list](https://developers.cloudflare.com/fundamentals/api/reference/permissions/) also call this access
**Workers Routes Edit**.

The module supplies the zone ID directly and attaches domains through the Workers API. It needs no DNS record,
account-settings, or token-administration grants. The image provider uses the selected account's Containers API to
[issue temporary registry credentials](https://developers.cloudflare.com/api/resources/containers/subresources/registries/subresources/credentials/methods/generate/)
for `registry.cloudflare.com`, requesting `pull` and `push` during upload. You do not supply a separate registry token.

Use a [remote state backend with locking](operations.md#state) when other operators or automation will apply this
installation. A local state file works for an initial single-operator setup; keep it private and backed up.

## Secrets

Open the account's [Secrets Store](https://dash.cloudflare.com/?to=/:account/secrets-store). An authorized Secrets Store
administrator can initialize the store from that page. Create these entries with **Workers** as their permission scope,
then record the store ID:

| Entry                          | Value                                                |
| ------------------------------ | ---------------------------------------------------- |
| `mechane-github-client-secret` | The OAuth app's client secret                        |
| `mechane-model-api-key`        | An API key for the selected model upstream           |
| `mechane-credential-keyring`   | A dedicated encryption keyring for this installation |

Create the keyring in a private file outside your infrastructure repository. This command writes the value without
printing it or passing it as a process argument:

```sh
umask 077
openssl rand -hex 32 | awk '{ printf "{\"current\":\"v1\",\"keys\":{\"v1\":\"%s\"}}\n", $0 }' > credential-keyring.json
```

Copy that file's contents into the keyring secret using your editor and the dashboard. Retain an encrypted backup, then
remove the temporary file. Existing workspace credentials need this keyring after a reinstall or recovery.

The [Secrets Store instructions](https://developers.cloudflare.com/secrets-store/integrations/workers/) explain secret
creation and scopes. The deployment token needs
[Secrets Store Edit](https://developers.cloudflare.com/secrets-store/access-control/) even when it only binds existing
secrets. Supply values through the store and the token through `CLOUDFLARE_API_TOKEN`; HCL contains only references.

## Configuration

Create a directory for the installation and download the pinned
[example](../infrastructure/examples/cloudflare/main.tf):

```sh
mkdir mechane-infrastructure
cd mechane-infrastructure
curl --fail --location --output main.tf \
  https://raw.githubusercontent.com/mechane-ai/mechane/v0.8.0/workspaces/core/infrastructure/examples/cloudflare/main.tf
```

Replace the account ID, hostname, zone ID, OAuth client ID, numeric GitHub identity, and Secrets Store ID in `main.tf`.
Choose a permanent Worker `name`; changing it creates a different installation. The module creates the private bucket,
Worker, Durable Objects, container image, application, and custom domain from the published release.

The example uses OpenRouter's `anthropic/claude-haiku-5.5`; its secret must be an OpenRouter API key. The following
values come from the [public model catalog](https://openrouter.ai/api/v1/models), retrieved on October 30, 2026 UTC:

| Catalog field              | Value                     |
| -------------------------- | ------------------------- |
| Context limit              | 1,000,000 tokens          |
| Maximum output             | 128,000 tokens            |
| Input price                | $0.10 per million tokens  |
| Output price               | $0.50 per million tokens  |
| Cache read price           | $0.01 per million tokens  |
| Standard cache write price | $0.125 per million tokens |

The example deliberately caps context at 65,536 tokens and output at 4,096. The catalog charges a higher tier starting
at 100,000 prompt tokens, and a separate rate for one-hour cache writes. Mechane's offers use fixed rates, so review
pricing tiers before increasing the caps or changing caching behavior. Prices do not update automatically.

Choose another model by editing `model.upstream` and its `offers` together, then use that upstream's credential. The
upstream must support OpenAI-compatible streaming chat completions and tool calls. Configure supported token limits and
all four prices from its current documentation. Rates are whole micro-dollars per million tokens: multiply a dollar
price per million by 1,000,000. For example, $0.10 becomes `100000`.

You can inspect the current OpenRouter entry with `jq`, if installed:

```sh
curl --fail --silent --show-error https://openrouter.ai/api/v1/models \
  | jq '.data[] | select(.id == "anthropic/claude-haiku-5.5") | {id, context_length, top_provider, pricing, supported_parameters}'
```

## Provider

While initial OpenTofu registry registration is pending, download the signed provider into a standard filesystem mirror.
The [setup helper](../infrastructure/examples/cloudflare/setup-provider.sh) verifies the release's GPG signature against
fingerprint `2229E3931B4A4739A439C9A357BF85C24B6B0DFA`, then verifies the original platform archive's SHA-256.

Download the versioned helper and check it against that release's checksum file before running it:

```sh
release=https://github.com/mechane-ai/mechane/releases/download/v0.8.0
curl --fail --location --output mechane-setup-provider-v0.8.0.sh "$release/mechane-setup-provider-v0.8.0.sh"
curl --fail --location --output SHA256SUMS "$release/SHA256SUMS"
expected=$(awk '$2 == "mechane-setup-provider-v0.8.0.sh" { print $1 }' SHA256SUMS)
actual=$(openssl dgst -sha256 mechane-setup-provider-v0.8.0.sh | awk '{ print $NF }')
test -n "$expected" && test "$actual" = "$expected" && sh mechane-setup-provider-v0.8.0.sh 0.7.0
export TF_CLI_CONFIG_FILE="$PWD/.mechane/tofurc"
tofu init
tofu validate
```

Continue only after the checksum comparison, helper, initialization, and validation succeed. The helper writes
`.mechane/provider-mirror` and `.mechane/tofurc` inside this directory. It refuses to overwrite a different existing
configuration and changes no global settings or lockfile. The Cloudflare provider still comes from its normal registry.
OpenTofu labels mirror packages `unauthenticated`; the helper performs their signature verification before installation.
Keep `TF_CLI_CONFIG_FILE` set for subsequent OpenTofu commands in this directory. If you already manage a CLI
configuration, merge the generated `provider_installation` rules there and select that file explicitly.

When using a shared lockfile on a new platform, run the helper on that machine and replace the first `tofu init` above
with:

```sh
tofu get
tofu providers lock -fs-mirror=.mechane/provider-mirror mechane-ai/mechane
tofu init
```

The lock command adds the native checksum from the verified mirror and retains checksums for other platforms. Review and
commit the updated `.terraform.lock.hcl`.

This is OpenTofu's documented
[filesystem mirror](https://opentofu.org/docs/cli/config/config-file/#provider-installation), using the unchanged
`mechane-ai/mechane` provider address. After registry registration is available, remove the mirror override and run
ordinary `tofu init` with your existing lockfile. For provider versions through 0.6.2, retain the archive's verified
`zh:` checksum in the lockfile; those immutable archives cannot rely on a mirror-generated `h1:` alone.

Commit `main.tf` and `.terraform.lock.hcl` to your infrastructure repository. Ignore `.mechane/`, `.terraform/`,
`*.tfstate`, `*.tfstate.*`, `*.tfplan`, and crash logs. The helper and public checksums may be retained for repeat
setup.

## Apply

Load the deployment token through your secret manager or a hidden prompt. Run the plan and review it before applying.
For example, in a Bash shell, read the token without recording its value in shell history:

```bash
read -rsp 'Cloudflare API token: ' CLOUDFLARE_API_TOKEN
printf '\n'
export CLOUDFLARE_API_TOKEN
tofu plan -out=installation.tfplan
tofu apply installation.tfplan
tofu plan -detailed-exitcode
```

Review the saved plan before applying it. A new installation creates resources; adoption requires imports first. The
final plan should report no changes and exit zero. `tofu apply` waits for the container rollout, but it does not
authenticate with GitHub or make a paid model call.

Check `https://YOUR_DOMAIN/health` and `https://YOUR_DOMAIN/v1/readiness`, then sign in through the browser. Follow
[self-hosting](self-hosting.md#use-the-service) to install the CLI and send a first task. Confirm a model response and a
cold sandbox startup; those checks use your model and Cloudflare accounts. See [operations](operations.md) for upgrades,
secret rotation, recovery, and shared access.
