import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Application integration establishes public-message, draft, and scroll ownership. */
export const uiConversationState = { values: {}, rules: [] } as const satisfies ContractEnforcement;
