/** The missing private-key reference keeps authorization probes from reaching GitHub. */
export const SOURCE_GRANT_CONFIGURATION = JSON.stringify({
  app_id: 1,
  installation_id: 1,
  repository_id: 1,
  owner: 'fixture',
  repository: 'private-source',
  base_branch: 'main',
  secret_reference: 'unconfigured-reader',
  write_paths: ['src'],
});
