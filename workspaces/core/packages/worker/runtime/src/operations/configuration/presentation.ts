import type {
  CredentialMetadata,
  ExecutionAccess,
  MemberRecord,
  WorkspacePolicy,
  WorkspaceRecord,
} from '@mechane/control-store';

export function workspaceWire(workspace: WorkspaceRecord) {
  return {
    kind: workspace.kind,
    id: workspace.id,
    name: workspace.name,
    role: workspace.role,
    daily_allowance_micros: workspace.dailyAllowanceMicros,
    created_at: workspace.createdAt,
  };
}

export function memberWire(member: MemberRecord) {
  return { principal_id: member.principalId, name: member.name, role: member.role, created_at: member.createdAt };
}

export function policyWire(policy: WorkspacePolicy) {
  return {
    suspended: policy.isSuspended,
    sandboxes: policy.hasSandboxes,
    machines: policy.machines,
    daily_allowance_micros: policy.dailyAllowanceMicros,
  };
}

export function credentialWire(credential: CredentialMetadata) {
  return {
    secret_reference: credential.reference,
    key_version: credential.keyVersion,
    created_at: credential.createdAt,
    updated_at: credential.updatedAt,
  };
}

export function executionAccessWire(access: ExecutionAccess | null): unknown {
  if (access === null) {
    return { access: null };
  }

  return { access: { variables: access.variables, secrets: access.secrets } };
}
