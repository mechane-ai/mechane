/** The steps that put a file at its path: a fresh file beside it written, renamed over it or linked, then removed. */
export const FileStep = { Write: 'write', Rename: 'rename', Link: 'link', Remove: 'remove' } as const;

export type FileStep = (typeof FileStep)[keyof typeof FileStep];
