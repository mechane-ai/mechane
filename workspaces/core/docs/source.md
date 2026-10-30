# Private source and draft pull requests

An installation can grant one repository to a mech for a coding task. Checkout reads the whole repository at an
immutable commit. Publication is an explicit workspace-owner operation and can change only selected regular files within
the grant's write paths. Scheduled checks and model tools have no publication operation.

Configure a GitHub App installed on the approved repository. It needs Contents read/write and Pull requests write to
support both checkout and draft publication. This is separate from the App used to export Mechane's own public source.
Select the workspace for these commands and store the App's downloaded PEM private key through the runtime API:

```sh
export MECHANE_WORKSPACE_ID=WORKSPACE_UUID
mechane credential put source-app --file /private/path/source-app.pem
```

Use `source-app` as the grant's `secret_reference`. Ordinary PKCS#1 PEM keys are accepted. The service encrypts the key
in workspace storage; it never enters a prompt, guest, execution receipt, or workspace snapshot. Credential changes
require no infrastructure update. See [credential management](remote-tools.md#configure-a-connection) for replacement
and deletion.

An owner configures the grant with `mechane source grant MECH_ID --configuration JSON`. The JSON contains `app_id`,
`installation_id`, `repository_id`, `owner`, `repository`, `base_branch`, `secret_reference`, and `write_paths`. A path
prefix grants that directory and its descendants; `.` grants ordinary files throughout the repository. `.git` paths and
GitHub workflow writes are refused. Grant edits and revocation are recorded with the acting principal.

Choose a fresh UUID and a full 40-character commit SHA, then call
`mechane source checkout MECH_ID --source-id UUID --commit SHA` until it reports `ready`. The durable directory is
`sources/UUID` under the mech's home. The checkout retains real Git metadata, the exact upstream commit, and a shallow
boundary. Dependencies, submodules, and Git LFS objects are not automatically installed. Give the mech the directory and
the coding objective in its normal instructions.

Checkout first fences normal executions and checkpoints the previous workspace without credentials. It then destroys the
old container, records a new machine identity, and restores the saved files into a fresh trusted guest. No model command
runs in that guest before credential revocation. This cold boundary prevents code injected into a previous guest process
from observing later tokens. The trusted Worker then mints a repository-scoped Contents-read installation token. The
sandbox persists the token's exact expiry before delivery. Trusted Git receives it only in the fetch process
environment; remote URLs, arguments, Git configuration files, and receipts contain no credential. System/global
configuration, hooks, credential helpers, automatic maintenance, and redirects are disabled. The Worker revokes the
token before making the worktree available. An uncertain revocation retains the fence until expiry plus a safety margin.
An abandoned preparation expires after five minutes; preparation never exposes a token. A lost fresh guest is not
restarted under a credential-bearing generation. A normal credential-free execution checkpoints the completed checkout
before reporting readiness.

Private-source checkout currently supports the container provider with portable workspace restoration and the cold guest
boundary. Host process fixtures accept only loopback HTTP fixture repositories. Tensorlake process scope is unqualified
and refuses real repository checkout before token issuance. The complete workspace, including `.git`, must fit a 512 MiB
uncompressed tar stream and a 256 MiB compressed snapshot. A failed preparatory save preserves the current machine and
its unsaved files. Qualify each installation's intended repositories and toolchains before admitting coding tasks.
Include Git metadata and generated files in the measured workspace size. Keep disposable dependency caches and build
output outside the durable home, and verify that a completed checkout survives checkpoint and restoration.

Use `mechane source access MECH_ID` to inspect the current grant without advancing a checkout or publication. Only a
current workspace owner can read it. The JSON result contains `grant: null` when no repository is granted, or the saved
grant metadata without its credential. An inaccessible workspace or missing mech is an error, not an absent grant.

After reviewing the desired files, call
`mechane source publish MECH_ID --source-id UUID --title TITLE --body BODY --paths '["src/file.ts"]'`. Selected absent
files become deletions. Capture rejects symbolic links, non-regular files, and patches over 512 KiB or 256 files. The
trusted Worker also checks the captured path set exactly against the owner-selected set and rechecks canonical content
and size before storing it. Draft descriptions are limited to 16,384 characters. These are publication limits, not
checkout limits. GitHub's recursive tree response must be complete; a truncated response refuses publication.

The Worker captures file bytes while the guest is quiescent. It validates paths against the current grant and the
original upstream tree, without executing agent-controlled Git configuration. The resulting commit has the server-pinned
original SHA as its sole parent and preserves every unselected path. It publishes the stable branch `mechane/UUID` and
creates a draft pull request with maintainer modification disabled. Its write token stays in the Worker and is revoked
after each observed attempt. Unconfirmed revocation is reported with the token expiry, preserving any confirmed draft
result.

Each source UUID permits one immutable publication intent. The selected bytes, title, description, paths, and original
commit are durable. Before the PR creation request, the Worker records that the request was attempted. If the outcome is
unknown, further owner requests only look for that exact draft and branch; they never blindly create a second PR. An
unobserved result remains uncertain for operator investigation. Reusing a UUID with another commit or publication intent
is refused.

`mechane source show MECH_ID --source-id UUID` reports the stored checkout and publication status.
`mechane source revoke MECH_ID` prevents new checkouts and future publication under the old grant. Already checked-out
files remain part of the mech's durable workspace.
