export const managedOidcMigrationSql = `
CREATE TABLE mechane.managed_oidc_identities (
  workspace_id uuid NOT NULL REFERENCES mechane.workspaces(id),
  issuer_url text NOT NULL,
  issuer_name text NOT NULL,
  subject_claim text NOT NULL,
  subject_value text NOT NULL,
  principal_id uuid NOT NULL UNIQUE REFERENCES mechane.principals(id),
  PRIMARY KEY(workspace_id, issuer_url, issuer_name, subject_claim, subject_value)
);
`;
