/** The longest name a mech may have. */
export const MECH_NAME_MAX_CHARS = 64;

/** The longest instructions a mech may have. */
export const INSTRUCTIONS_MAX_CHARS = 65_536;

/** Whether the mech runs queued work, holds it, or also refuses incoming work while retaining history. */
export const MechStatus = { Active: 'active', Paused: 'paused', Archived: 'archived' } as const;

export type MechStatus = (typeof MechStatus)[keyof typeof MechStatus];
