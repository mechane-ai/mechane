import type {
  CredentialMetadata,
  ExecutionAccess,
  SlackBinding,
  SlackDelivery,
  SlackInstallation,
} from '../../domain.ts';
import type {
  ConnectionRecord,
  MemberRecord,
  ToolGrantRecord,
  WorkspacePolicy,
  WorkspaceRecord,
} from '../../store/api/configuration/types.ts';

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

export function connectionWire(connection: ConnectionRecord) {
  return {
    id: connection.id,
    name: connection.name,
    url: connection.url,
    secret_reference: connection.secretReference,
    allowed_tools: connection.allowedTools,
    policy: connection.policy,
    created_at: connection.createdAt,
    updated_at: connection.updatedAt,
  };
}

export function grantWire(grant: ToolGrantRecord) {
  return { mech_id: grant.mechId, connection_id: grant.connectionId, tools: grant.tools };
}

export function executionAccessWire(access: ExecutionAccess | null): unknown {
  if (access === null) {
    return { access: null };
  }

  return {
    access: {
      github: githubAccessWire(access.github),
      variables: access.variables,
      secrets: access.secrets,
      request_service: requestServiceWire(access.requestService),
    },
  };
}

function githubAccessWire(github: ExecutionAccess['github']): unknown {
  if (github === null) {
    return null;
  }

  return {
    app_id: github.appId,
    installation_id: github.installationId,
    repository_id: github.repositoryId,
    owner: github.owner,
    repository: github.repository,
    secret_reference: github.secretReference,
  };
}

function requestServiceWire(requestService: ExecutionAccess['requestService']): unknown {
  if (requestService === null) {
    return null;
  }

  return {
    url: requestService.url,
    service_id: requestService.serviceId,
    secret_reference: requestService.secretReference,
  };
}

export function installationWire(installation: Omit<SlackInstallation, 'updatedAt'>): unknown {
  const result = {
    id: installation.id,
    workspace_id: installation.workspaceId,
    team_id: installation.teamId,
    bot_user_id: installation.botUserId,
    signing_secret_reference: installation.signingSecretReference,
    bot_token_secret_reference: installation.botTokenReference,
    api_origin: installation.apiOrigin,
  };

  if (installation.historyTokenReference === null) {
    return result;
  }

  return { ...result, history_token_secret_reference: installation.historyTokenReference };
}

export function bindingWire(binding: Omit<SlackBinding, 'workspaceId'>): unknown {
  const result = {
    id: binding.id,
    connection_id: binding.installationId,
    team_id: binding.teamId,
    channel_id: binding.channelId,
    channel_kind: binding.channelKind,
    mech_id: binding.mechId,
    listening: binding.isListening,
    reply_enabled: binding.isReplyEnabled,
  };

  if (binding.allowedUserIds === null) {
    return result;
  }

  return { ...result, allowed_user_ids: binding.allowedUserIds };
}

export function deliveryWire(delivery: SlackDelivery, binding: SlackBinding): unknown {
  const destination = {
    bindingId: binding.id,
    connectionId: binding.installationId,
    teamId: binding.teamId,
    channelId: delivery.channelId,
    threadTimestamp: delivery.threadId,
  };

  if (delivery.threadId.length === 0) {
    return { ...deliveryRecord(delivery), destination: { ...destination, threadTimestamp: null } };
  }

  return { ...deliveryRecord(delivery), destination };
}

function deliveryRecord(delivery: SlackDelivery) {
  return {
    id: delivery.id,
    binding_id: delivery.bindingId,
    status: deliveryStatus(delivery.status),
    created_at: Date.parse(delivery.createdAt),
    next_attempt_at: null,
    message_timestamp: delivery.messageId,
    last_error: delivery.lastError,
  };
}

function deliveryStatus(status: SlackDelivery['status']): 'pending' | 'sent' | 'uncertain' | 'blocked' {
  switch (status) {
    case 'pending':
    case 'sending':
      return 'pending';
    case 'delivered':
      return 'sent';
    case 'failed':
    case 'blocked':
      return 'blocked';
    case 'uncertain':
      return 'uncertain';
  }
}
