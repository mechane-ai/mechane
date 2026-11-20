export type Identity = { readonly provider: 'github'; readonly subject: string; readonly login: string };

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

export type Allowance = {
  readonly workspaceId: string;
  readonly mechId: string | null;
  readonly date: string;
  readonly capMicros: number;
  readonly spentMicros: number;
  readonly reservedMicros: number;
};
