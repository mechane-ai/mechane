# @mechane/credentials

How keys, device codes, user codes and session tokens are minted, and the hash the directory stores.

Layer 2 · shared lane · effect dialect · consumers: edge and pages

## Surface

`issueToken`, `issueUserCode` and `tokenHash`.

## Use

Mint a token with `issueToken` under its kind's prefix, and store or look it up only by `tokenHash`. A user code comes
from `issueUserCode`, whose letters the protocol's alphabet names.

## Never

Store or log a token in plain text, or mint one from anything but the runtime's secure random source.
