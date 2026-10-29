/** What a pass did to a file of the factory when it failed, which the failure's diagnostic names. */
export const FileStep = { List: 'list', Read: 'read', Write: 'write', Decode: 'decode' } as const;

export type FileStep = (typeof FileStep)[keyof typeof FileStep];
