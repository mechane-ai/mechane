/** Each organization starts with its installation's sandbox alongside any external worker environments. */
export const installedEnvironmentMigrationSql = `
CREATE FUNCTION mechane.install_sandbox_environment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO mechane.managed_environments(id, workspace_id, creator_id, name)
    VALUES ('env_' || replace(NEW.id::text, '-', ''), NEW.id, NEW.creator_id, 'Mechane sandbox');
  RETURN NEW;
END;
$$;
CREATE TRIGGER install_sandbox_environment AFTER INSERT ON mechane.workspaces
  FOR EACH ROW WHEN (NEW.personal_owner_id IS NULL) EXECUTE FUNCTION mechane.install_sandbox_environment();
INSERT INTO mechane.managed_environments(id, workspace_id, creator_id, name)
  SELECT 'env_' || replace(id::text, '-', ''), id, creator_id, 'Mechane sandbox'
  FROM mechane.workspaces WHERE personal_owner_id IS NULL;
`;
