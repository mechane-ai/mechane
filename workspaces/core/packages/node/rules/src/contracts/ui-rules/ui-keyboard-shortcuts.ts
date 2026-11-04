import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Browser review verifies command ownership, editable targets, scopes, and native shortcut preservation. */
export const uiKeyboardShortcuts = { values: {}, rules: [] } as const satisfies ContractEnforcement;
