# Agent environments

A mech is the durable agent. Slack and the Console deliver messages to its existing conversation, memories, and open
work. The sandbox supplies replaceable compute and committed files. The agent chooses its commands and follows the
repository's instructions; Mechane does not prescribe coding, review, or deployment stages.

## Configure access

A current workspace owner uses `mechane credential put <reference> --file <private-file>` to encrypt an application
credential. `mechane execution-access set <mech-id> --access '<JSON>'` grants the mech references and public variables:

```json
{
  "github": null,
  "request_service": null,
  "variables": { "APPLICATION_URL": "https://tools.example.com" },
  "secrets": { "APPLICATION_API_KEY": "application-agent" }
}
```

`execution-access show` returns references, never secret values. Pass `null` to `execution-access set` to revoke future
command access. Forks and drones receive no grant implicitly. Existing source-publication grants remain separate; their
selected write paths cannot be converted into repository-wide command authority automatically.

For GitHub, replace `github: null` with `app_id`, `installation_id`, `repository_id`, `owner`, `repository`, and
`secret_reference`. The reference contains the GitHub App signing key. The runtime mints a repository-limited token with
contents, pull-request, and issue write permissions plus checks and Actions read permissions. The App installation must
already hold those permissions. GitHub's branch rules and reviews still determine whether a merge is permitted.

Normal `gh` reads `GH_TOKEN` and `GH_REPO`. Git uses a transient helper restricted to HTTPS and that repository path.
Configure `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME`, and `GIT_COMMITTER_EMAIL` as public variables for
the desired bot identity. No runtime step writes credentials into Git configuration or remote URLs.

Application CLIs use their normal environment inputs. Nexus accepts `NEXUS_API_KEY` and `NEXUS_URL`; its service account
owns its company grants and expiry. The agent receives neither the owner's browser session nor credential-management
authority. Rotate an application key through its service, update the existing encrypted reference, then revoke the old
key. Keep its stable service identity.

For service-owned access requests, add `request_service` with the collection's `url` and a host-only `secret_reference`.
For example, a Nexus installation uses `https://softmax.nexus/api/v1/requests`. Keep this credential in a different
vault reference from the sandbox's application key. It never enters the command environment or model context. The
service must separately enable trusted runtime attribution on that credential; a sandbox-supplied header conveys no
authority. The service decides which capabilities are standing, automatically granted with notification, or
approval-gated.

Credentials reach each command through trusted runtime transport. Exact values are redacted before captured output is
retained. The code running in the guest can read and copy its credentials, so grant only intended authority. A grant
change affects subsequent issuance. A running GitHub token is revoked after a known terminal result; an interrupted wait
leaves it to its provider expiry so an existing command can finish.

## Files and tools

The generic image includes Bash, Git, Node, GitHub CLI, mise, Python, and native build tools. Downloaded tools have
pinned versions and checked architecture-specific hashes. Additional tools can be installed in the sandbox; repository
pins remain authoritative for a checkout.

```text
/home/node/
  artifacts/          selected evidence
  repos/              source, Git metadata, and edits
  .local/bin/         installed application CLIs, included in PATH
/tmp/mechane/
  build/              reproducible build output
  cache/              reproducible dependency and tool caches
```

The complete home is checkpointed after a completed command, bounded to 512 MiB uncompressed and 256 MiB compressed. A
failed checkpoint remains visible and retains the previous saved generation. Avoid large dependency installations inside
the home; use explicit scratch/cache settings and recreate them after machine replacement. Mechane does not silently
discard ignored or untracked files.

An installation can add validated HTTPS hosts through `sandboxes.additional_hosts` in the Cloudflare module. Each
redirect destination needs its own allowance. Public certificate trust, authority validation, and private-network
isolation remain in effect. Company-specific endpoints belong in installation configuration.

## Continue unfinished work

Use `open_thread` for work that outlives a turn. Save useful external references, branch names, and the next action in
its note. To wait for CI, call `update_thread` with `state: "waiting"` and `resume_after_seconds` from 30 to 86400. The
runtime retains one pending wakeup per thread. A later update replaces it; resolving the thread cancels it. Omitting the
delay waits for another message instead.

When the mech is idle, a due wakeup enters its normal inbox once. Paused mechs retain it until resumed. A wait survives
runtime replacement without holding a model request or shell open. The original trusted Slack input determines where a
continuation replies; later messages cannot change that destination. Existing Slack mute and binding checks apply.

On waking, inspect the external state before acting. Use ordinary `gh` commands for PRs, checks, and authorized merges.
Read the deployment's actual revision and health evidence before saying a change is live. A timer is sufficient for this
workflow; no credential callback service is needed.

Use `request_access` with `thread_id`, the service's capability, a reason, and optional duration in minutes. A pending
request automatically marks that work waiting. Explain the wait and finish the turn; the host polls the configured
collection without consuming model turns. It resumes the original work and Slack thread after approval, refusal,
revocation, expiry, or a permanent service failure. Do not replace this wait with `update_thread` or a polling shell.

For a request already created by a CLI, call `wait_for_request` with `thread_id`, `kind` (`access`, `vend`, or
`action`), and `request_id`. Read `task_context` when verified attribution helps explain the request. The host attaches
this context itself; callers cannot choose another requester. A ready vend means the agent may collect it through the
CLI, not that Mechane has stored a token. Recheck the operation's actual result before declaring the task done.

One wait lasts at most a day and follows the original configured collection and credential reference. Changing that
configuration fails the wait visibly. Resolving the work or replacing its wait prevents a late decision from reviving
it.

A repeated execution ID rejoins its original command. Background observation never resubmits the command to recover a
receipt. If a machine disappears before a result is recorded, the result stays uncertain. Check the remote branch, PR,
and deployment before deciding whether to retry an external write.

## Qualify an installation

Run the repository smoke before publishing a runtime. Separately qualify a real target checkout on its selected image,
network policy, and credentials. Record required checks, file size and checkpoint behavior, restart recovery, and the
model's actual coding result in the delivery issue. Docker-dependent checks require a capable environment; a missing
capability is not a passed suite.

The end-to-end proof starts with a real Slack request and ends with a verified deployed revision in the same thread.
Keep the checked PR head, merge, workflow, and deployed revision together. Foundation owns Softmax installation choices;
Nexus owns its development and release instructions. Mechane owns only generic execution and durable continuation.
