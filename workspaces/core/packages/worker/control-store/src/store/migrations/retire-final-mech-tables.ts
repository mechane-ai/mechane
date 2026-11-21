export const retireFinalMechTablesMigrationSql = `
DROP TABLE IF EXISTS mechane.sandbox_capacity CASCADE;
DROP TABLE IF EXISTS mechane.mechs CASCADE;
`;
