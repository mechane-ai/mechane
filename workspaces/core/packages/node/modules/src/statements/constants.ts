/** What an import or a re-export statement takes: types only, or values with their types. */
export const ModuleKind = { Type: 'type', Value: 'value' } as const;

export type ModuleKind = (typeof ModuleKind)[keyof typeof ModuleKind];
