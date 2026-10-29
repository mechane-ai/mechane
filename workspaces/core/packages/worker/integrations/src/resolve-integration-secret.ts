import type { IntegrationSecrets } from '@mechane/deployment';
import type { WorkspaceId } from '@mechane/records';
import { Option, Redacted } from 'effect';

type ResolveIntegrationSecretInput = {
  /** None means the operator has configured no integration credentials. */
  readonly secrets: Option.Option<IntegrationSecrets>;
  readonly workspaceId: typeof WorkspaceId.Encoded;
  readonly secretReference: string;
};

/** Resolves only within the requested workspace; absence never falls back to another scope. */
export function resolveIntegrationSecret({
  secrets,
  workspaceId,
  secretReference,
}: ResolveIntegrationSecretInput): Option.Option<Redacted.Redacted> {
  if (Option.isNone(secrets)) {
    return Option.none();
  }

  const configured = Redacted.value(secrets.value);
  const workspace = Option.fromUndefinedOr(configured[workspaceId]);

  return workspace.pipe(
    Option.flatMap((values) => Option.fromUndefinedOr(values[secretReference])),
    Option.map(Redacted.make),
  );
}
