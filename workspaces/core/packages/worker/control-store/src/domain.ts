export type Identity = { readonly provider: 'github'; readonly subject: string; readonly login: string };

export type MechDefinition = {
  readonly name: string;
  readonly model: string;
  readonly instructions: string | null;
  readonly dailyCapMicros: number;
  readonly status: 'active' | 'paused' | 'archived';
};

export type ForkProvenance = { readonly mechId: string; readonly sequence: number };

export type Mech = MechDefinition & {
  readonly id: string;
  readonly workspaceId: string;
  readonly creatorId: string;
  readonly revision: number;
  readonly updaterId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly forkedFrom: ForkProvenance | null;
};

export type MechRevision = MechDefinition & {
  readonly mechId: string;
  readonly revision: number;
  readonly updaterId: string;
  readonly updatedAt: string;
};

export type ExecutionAccess = {
  readonly variables: Readonly<Record<string, string>>;
  readonly secrets: Readonly<Record<string, string>>;
};

export type CredentialEnvelope = { readonly keyVersion: string; readonly nonce: string; readonly ciphertext: string };

export type CredentialMetadata = {
  readonly workspaceId: string;
  readonly reference: string;
  readonly keyVersion: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CredentialKeyring = { readonly current: string; readonly keys: Readonly<Record<string, string>> };

export type ModelUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
};

export type Allowance = {
  readonly workspaceId: string;
  readonly mechId: string | null;
  readonly date: string;
  readonly capMicros: number;
  readonly spentMicros: number;
  readonly reservedMicros: number;
};
