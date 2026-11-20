export type WorkspaceActor = {
  readonly workspaceId: string;
  readonly principalId: string;
  readonly credentialId?: string | null;
};

export type WorkspaceRecord = {
  readonly kind: 'personal' | 'shared';
  readonly id: string;
  readonly name: string;
  readonly role: 'owner' | 'member';
  readonly dailyAllowanceMicros: number;
  readonly createdAt: string;
};

export type MemberRecord = {
  readonly principalId: string;
  readonly name: string;
  readonly role: 'owner' | 'member';
  readonly createdAt: string;
};

export type WorkspacePolicy = {
  readonly isSuspended: boolean;
  readonly hasSandboxes: boolean;
  readonly machines: number;
  readonly dailyAllowanceMicros: number;
};
