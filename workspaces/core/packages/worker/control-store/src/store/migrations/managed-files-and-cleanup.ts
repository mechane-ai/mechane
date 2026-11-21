import { managedFilesMigrationSql } from '@mechane/managed-store';

export const managedFilesAndCleanupMigrationSql = `${managedFilesMigrationSql}
DROP TABLE IF EXISTS mechane.spend_reservations CASCADE;
DROP TABLE IF EXISTS mechane.execution_access CASCADE;
DROP TABLE IF EXISTS mechane.mcp_connections CASCADE;
DROP TABLE IF EXISTS mechane.slack_installations CASCADE;
`;
