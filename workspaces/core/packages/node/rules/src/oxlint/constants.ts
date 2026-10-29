/**
 * The two rules that hold the restricted rules' entries, banned imports and banned properties, whose findings count
 * under the rule of the standard that each entry's message ends with.
 */
export const RestrictedKey = { Imports: 'no-restricted-imports', Properties: 'no-restricted-properties' } as const;

export type RestrictedKey = (typeof RestrictedKey)[keyof typeof RestrictedKey];
