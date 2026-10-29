# @mechane/cli-login

The `mechane` command's login: the saved login's private files, the key each command sends, device approval, and the
auth commands' runs.

Layer 5 · node lane · effect dialect · consumers: cli

## Layout

- `src/`: the saved login's format and the runs of `auth login`, `auth status` and `auth logout`; the key a command
  sends, from the API key variable or the saved login; device approval and its poll; and the revocation of a replaced
  login key.
- `src/store/`: the saved login and a key file, each written to a fresh file in a private folder and renamed.

## Rules

The [product contracts](../../../.contracts/index.md) apply, with
[052](../../../.contracts/052-security-cli-credential-lifecycle/CONTRACT.md) for the saved login and
[045](../../../.contracts/045-data-store-ownership/CONTRACT.md) for its files.

## Use

A run that needs a key calls `withCredential`; `key create` approves its key through `approveDevice` and writes it with
`prepareKeyFile`. A saved login whose key the deployment refuses as unauthenticated is removed.

## Never

- Never quote a key in a failure or a diagnostic, and never take one from a flag.
- Never send the saved login's key to an origin other than the one that issued it.
