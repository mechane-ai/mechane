# Run your own Mechane

An installation runs the built Node service with Postgres and an authenticated sandbox service. The Node process owns
HTTP, GitHub sign-in, domain APIs, Chat SDK, and the native Workflow worker. Cloudflare hosts compute and persistent
workspace checkpoints. Its public ingress can forward the installation's domain to the Node host.

The same Node build and Workflow Postgres World run locally. Follow the [local guide](../packages/node/stack/README.md)
for a development or retained local installation.

## Ownership

| Infrastructure configuration                      | Runtime records                                  |
| ------------------------------------------------- | ------------------------------------------------ |
| Service versions, host, domains, compute capacity | Principals, workspaces, memberships, mechs       |
| Database roles and secret references              | Sessions, messages, runs, work, memory           |
| Model offers and installation ceilings            | Usage, execution grants, integration credentials |
| Sandbox image, file bucket, network policy        | Slack installations, bindings, delivery receipts |

Infrastructure applies do not seed or overwrite runtime records. Configure the installation first, then use owner APIs
for workspace setup. Keep one infrastructure state and writer for each installation.

## Artifacts

Consume immutable release artifacts with their recorded source revision and SHA-256 checksums. The runtime archive
contains compiled JavaScript and Console assets; operators do not rebuild application source. Deploy the matching
sandbox service and guest image. Keep the release manifest with the installation declaration.

A managed Node host must support a persistent process, health checks, graceful termination, and outbound Postgres
connections. Keep at least one process available for the Workflow worker. Rolling replacement can briefly run two
instances; durable claims and receipts coordinate them. No private Workflow callback route should be publicly exposed.

Configure a stable HTTPS public origin and the fixed GitHub callback `/auth/github/callback`. The reverse proxy forwards
streams without buffering and does not become a second authentication service. It removes untrusted forwarding headers
before supplying its own trusted values.

## Secrets

Supply the runtime, migration, OAuth, model, vault, sandbox, and Nexus callback secrets through the installation's
secret store. Keep values out of manifests, image layers, HCL, logs, and browser assets. Separate the migration
connection from the runtime connection. Run owned and upstream schema bootstrap with the migration credential before
activation.

Workspace credentials enter through authenticated write-only APIs. Their encrypted records bind each secret to its
workspace and reference. Metadata reads expose no value. Keep previous keyring versions until every retained ciphertext
and backup that needs them has been replaced.

## Use

Select the origin and sign in with an admitted identity:

```sh
export MECHANE_ORIGIN=https://agents.example.com
mechane auth login
mechane mech create --name scout
mechane inbox send MECH_ID 'hello, scout'
```

An installation administrator can create a shared workspace. Workspace owners configure membership, credentials,
[execution access](agent-environments.md), and [Slack bindings](slack.md). Installation admission and workspace
membership are separate grants. The CLI help and [operation catalog](../packages/shared/protocol/src/catalog.ts) are the
maintained command and wire references.

## Upgrades

Review the [operations guide](operations.md) before applying a release. Preserve Postgres state, vault key versions,
sandbox identities, and file checkpoints. Native Workflow histories must remain replayable across overlapping code
versions. A new SDK version requires a compiled restart-and-resume qualification before publication.

The native-runtime cutover establishes a fresh agent-store baseline. It is not a permanent reset-on-deploy policy. Later
data changes follow the schema and execution contracts, including pending approval waits and uncertain commands.
