import type { ContractEnforcement } from '@mechane/rule-shapes';

/** CLI smoke, typed boundaries, and provider qualification enforce these runtime guarantees. */
export const executionAccess = { values: {}, rules: [] } as const satisfies ContractEnforcement;
/** Native routine and external-result recovery checks enforce ordinary inbox delivery without duplicate paid work. */
export const mechNotifications = { values: {}, rules: [] } as const satisfies ContractEnforcement;
/** Image qualification and deployment checks enforce the developer environment. */
export const developerEnvironments = { values: {}, rules: [] } as const satisfies ContractEnforcement;

/** Provider-request smoke and live usage qualification enforce the caching protocol. */
export const modelCaching = { values: {}, rules: [] } as const satisfies ContractEnforcement;

/** Real guest lifecycle checks establish process identity, checkpoint and shutdown behavior. */
export const managedProcesses = { values: {}, rules: [] } as const satisfies ContractEnforcement;
/** Browser qualification establishes observed actions, isolation and bounded output. */
export const browserControl = { values: {}, rules: [] } as const satisfies ContractEnforcement;
/** Evidence qualification checks durable capture receipts, authorization and truthful provenance. */
export const browserEvidence = { values: {}, rules: [] } as const satisfies ContractEnforcement;
/** Private transfer checks establish capture ownership, byte integrity and safe repeated copies. */
export const evidenceExport = { values: {}, rules: [] } as const satisfies ContractEnforcement;
