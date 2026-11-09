import type { ExecutionAccess } from '../../../domain.ts';

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

export type ConnectionConfiguration = {
  readonly name: string;
  readonly url: string;
  readonly secretReference: string | null;
  readonly allowedTools: ReadonlyArray<string>;
  readonly policy: 'read_only_free';
};

export type ConnectionRecord = ConnectionConfiguration & {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ToolGrantRecord = {
  readonly mechId: string;
  readonly connectionId: string;
  readonly tools: ReadonlyArray<string>;
};

export type ExecutionAccessInput = WorkspaceActor & {
  readonly mechId: string;
  readonly access: ExecutionAccess | null;
};
