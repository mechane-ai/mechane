import type { ContractEnforcement, ContractName } from '@mechane/rule-shapes';
import { apiTypescriptRequestPaths } from './api-typescript-request-paths.ts';
import { dataAndApis } from './data-and-apis.ts';
import { dataRecordIdentifiers } from './data-record-identifiers.ts';
import { dataSqlSchemaRollouts } from './data-sql-schema-rollouts.ts';
import { dataSqlStoreBoundaries } from './data-sql-store-boundaries.ts';
import { dataStoreOwnership } from './data-store-ownership.ts';
import { dataStoredAndShippedFormats } from './data-stored-and-shipped-formats.ts';

/** The registry's entry for each contract of the data section, in the order of their folders. */
export const DATA_CONTRACTS = {
  'data-record-identifiers': dataRecordIdentifiers,
  'data-store-ownership': dataStoreOwnership,
  'data-sql-store-boundaries': dataSqlStoreBoundaries,
  'data-stored-and-shipped-formats': dataStoredAndShippedFormats,
  'data-and-apis': dataAndApis,
  'data-sql-schema-rollouts': dataSqlSchemaRollouts,
  'api-typescript-request-paths': apiTypescriptRequestPaths,
} as const satisfies Readonly<Partial<Record<ContractName, ContractEnforcement>>>;
