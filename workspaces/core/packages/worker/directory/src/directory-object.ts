import { openDirectoryStore } from '@mechane/directory-store';
import type { DirectoryStore } from '@mechane/directory-store';
import { writeLog } from '@mechane/logs';
import { catalog, LogEvent } from '@mechane/protocol';
import type { KeyAccessAnswer } from '@mechane/protocol';
import type { StateHashInput, TokenHashInput } from '@mechane/records';
import {
  DirectoryWorkspaces,
  KeyRevocation,
  KeyTokenAnswer,
  LiveSession,
  PendingApproval,
  SignInClaim,
  WorkspaceMembership,
} from '@mechane/rpc';
import type {
  ApprovalClaim,
  ApprovalDecision,
  ApproveDeviceApprovalInput,
  BrowserSessionOpening,
  ClaimDeviceApprovalInput,
  DeviceApprovalOpening,
  DirectoryKeyPage,
  DirectoryRpc,
  KeysOfPrincipalQuery,
  OwnedKey,
  PrincipalIdInput,
  SignInOpening,
  UserCodeInput,
  WorkspaceIdInput,
  WorkspaceMembershipInput,
} from '@mechane/rpc';
import { DurableObject } from 'cloudflare:workers';
import { DateTime, Duration, Option, Schema } from 'effect';
import { decideApproval } from './device-approvals/decide-approval.ts';
import { decideClaim } from './device-approvals/decide-claim.ts';
import { readKeyAccess } from './keys/read-key-access.ts';
import { lifespan } from './lifespan.ts';

/**
 * The one directory of a deployment; the Workers runtime instantiates it, and the Worker calls its methods by RPC. Each
 * method decides and writes synchronously, so no other call interleaves with it, and answers with plain data that the
 * Worker decodes; the Worker hashes every token before it calls. Key validity is cached, and workspace admission reads
 * current membership from this directory on every request.
 */
export class DirectoryObject extends DurableObject<unknown> implements DirectoryRpc {
  readonly #store: DirectoryStore;

  constructor(state: DurableObjectState, environment: unknown) {
    super(state, environment);

    this.#store = openDirectoryStore({ storage: state.storage });
  }

  /** The count of schema migrations the directory's database has applied. */
  schemaRevision(): number {
    return this.#store.schemaRevision();
  }

  openDeviceApproval({ approval, lifetimeMs }: DeviceApprovalOpening): void {
    this.#store.openDeviceApproval({
      approval: { ...approval, ...lifespan({ now: DateTime.nowUnsafe(), lifetime: Duration.millis(lifetimeMs) }) },
    });
  }

  pendingDeviceApproval({ userCode }: UserCodeInput): typeof PendingApproval.Encoded {
    const pending = this.#store.pendingDeviceApproval({ userCode, now: DateTime.nowUnsafe() });

    if (Option.isNone(pending)) {
      return PendingApproval.cases.NotPending.make({});
    }

    const { purpose, keyName, keyLifetime, createdAt, peerAddress, peerCountry } = pending.value;

    return Schema.encodeSync(PendingApproval)(
      PendingApproval.cases.Pending.make({ purpose, keyName, keyLifetime, createdAt, peerAddress, peerCountry }),
    );
  }

  approveDeviceApproval({
    userCode,
    sessionTokenHash,
    dailyAllowanceMicros,
  }: ApproveDeviceApprovalInput): typeof ApprovalDecision.Encoded {
    const now = DateTime.nowUnsafe();

    return decideApproval({ store: this.#store, userCode, sessionTokenHash, dailyAllowanceMicros, now });
  }

  claimDeviceApproval({ pollTokenHash, keyId, keyTokenHash }: ClaimDeviceApprovalInput): typeof ApprovalClaim.Encoded {
    return decideClaim({ store: this.#store, pollTokenHash, keyId, keyTokenHash, now: DateTime.nowUnsafe() });
  }

  keyAccess({ tokenHash }: TokenHashInput): typeof KeyAccessAnswer.Encoded {
    return readKeyAccess({ store: this.#store, tokenHash });
  }

  /** The model spend the workspace may make each UTC day, which its mechs' dispatches reserve against. */
  dailyAllowanceMicros({ workspaceId }: WorkspaceIdInput): number {
    return this.#store.dailyAllowanceMicros({ workspaceId });
  }

  keysOfPrincipal({ principalId, query }: KeysOfPrincipalQuery): typeof DirectoryKeyPage.Encoded {
    return this.#store.keysOfPrincipal({ principalId, ...Schema.decodeUnknownSync(catalog.listKeys.query)(query) });
  }

  keyTokenHash({ principalId, keyId }: OwnedKey): typeof KeyTokenAnswer.Encoded {
    return Option.match(this.#store.keyTokenHash({ principalId, keyId }), {
      onNone: () => KeyTokenAnswer.cases.NotFound.make({}),
      onSome: (tokenHash) => KeyTokenAnswer.cases.Found.make({ tokenHash }),
    });
  }

  revokeKey({ principalId, keyId }: OwnedKey): typeof KeyRevocation.Encoded {
    const revoked = this.#store.revokeKey({ principalId, keyId, now: DateTime.nowUnsafe() });

    if (Option.isNone(revoked)) {
      return KeyRevocation.cases.NotFound.make({});
    }

    writeLog({ line: { event: LogEvent.KeyRevoked, keyId, principalId } });

    return { _tag: 'Revoked', key: revoked.value };
  }

  workspacesOfPrincipal({ principalId }: PrincipalIdInput): typeof DirectoryWorkspaces.Encoded {
    return Schema.encodeSync(DirectoryWorkspaces)(this.#store.workspacesOfPrincipal({ principalId }));
  }

  workspaceMembership({ principalId, workspaceId }: WorkspaceMembershipInput): typeof WorkspaceMembership.Encoded {
    const membership = this.#store.workspaceMembership({ principalId, workspaceId });

    return Option.match(membership, {
      onNone: () => WorkspaceMembership.cases.NotMember.make({}),
      onSome: (role) => WorkspaceMembership.cases.Member.make({ role }),
    });
  }

  openBrowserSession({ session, lifetimeMs }: BrowserSessionOpening): void {
    this.#store.openBrowserSession({
      session: { ...session, ...lifespan({ now: DateTime.nowUnsafe(), lifetime: Duration.millis(lifetimeMs) }) },
    });
  }

  liveBrowserSession({ tokenHash }: TokenHashInput): typeof LiveSession.Encoded {
    return Option.match(this.#store.liveBrowserSession({ tokenHash, now: DateTime.nowUnsafe() }), {
      onNone: () => LiveSession.cases.SignedOut.make({}),
      onSome: (identity) => LiveSession.cases.Live.make(identity),
    });
  }

  openSignIn({ signIn, lifetimeMs }: SignInOpening): void {
    this.#store.openSignIn({
      signIn: { ...signIn, ...lifespan({ now: DateTime.nowUnsafe(), lifetime: Duration.millis(lifetimeMs) }) },
    });
  }

  claimSignIn({ stateHash }: StateHashInput): typeof SignInClaim.Encoded {
    return Option.match(this.#store.claimSignIn({ stateHash, now: DateTime.nowUnsafe() }), {
      onNone: () => SignInClaim.cases.Unclaimable.make({}),
      onSome: () => SignInClaim.cases.Claimed.make({}),
    });
  }
}
