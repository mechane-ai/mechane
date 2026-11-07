# Configure Cloudflare compute

Cloudflare hosts Mechane's sandbox service, container image, persistent file bucket, and optional public ingress. The
Node service and Postgres run separately. Start with [self-hosting](self-hosting.md) for the full installation boundary;
deploying a Worker alone does not provide an agent runtime.

## Account and resources

Choose an account with Workers, Containers, R2, and the required secret-store access. Keep compute namespace and bucket
identities stable across ordinary upgrades. Use a dedicated deployment credential scoped to that account and the zone
containing the installation's public domain. Keep credentials out of HCL, state inputs, and checked-in examples.

Deploy the immutable sandbox-service artifact and matching digest-pinned guest image from the selected Mechane release.
The service exposes authenticated internal compute routes and may forward other requests to the configured Node host. It
contains no agent dispatcher, workspace database, or OAuth authority.

The sandbox service receives a dedicated runtime bearer secret, file-storage bindings, image configuration, and egress
policy. The Node host receives the corresponding service origin and credential privately. Do not reuse a workspace
integration key or GitHub credential for this channel.

## Public ingress

Point the public installation domain at the ingress. Configure its Node target as trusted installation data; callers
cannot choose the upstream URL. Preserve response status, headers, and streaming bodies. Strip untrusted forwarding
headers before adding the proxy's own values. Application authentication remains in the Node server.

Use the public origin for GitHub's homepage and fixed `/auth/github/callback` URL. OAuth and model secrets belong to the
Node deployment. They are not necessary for the compute Worker to execute commands.

## Egress and files

Disable direct container internet access and configure the declared gateway before machine startup. Admit required
package and application hosts explicitly. Validate URL and Host authority, keep TLS verification enabled, and refuse
private or unsupported destinations. A changed network policy needs a replacement machine through the checkpoint
lifecycle; it is not applied by destroying an active machine's files.

The file bucket contains committed workspace generations. Keep its retention and access policy separate from release
artifacts and infrastructure state. An infrastructure cleanup must not remove runtime files as a side effect.

## Verify

Review a plan for unintended namespace, bucket, or container replacement before applying it. After activation, verify
the authenticated compute route, a command receipt, a checkpoint restore, and public stream forwarding. A repeat plan
should report no changes. Record live resource and release evidence in the installation's delivery record.

The [sandbox service](../packages/worker/sandbox-service) and
[sandbox lifecycle guide](../packages/worker/sandbox/README.md) own binding and execution details. The
[operations guide](operations.md) covers deployment recovery and secret rotation.
