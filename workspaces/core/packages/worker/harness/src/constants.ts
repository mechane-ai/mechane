/** Why a turn ended without a reply, in Mechane's terms: its model failed, or its own work faulted. */
export const TurnFailure = { Model: 'model', Fault: 'fault' } as const;

export type TurnFailure = (typeof TurnFailure)[keyof typeof TurnFailure];

/** The provider id under which every mech's conversation names its model; pi stores it, so it is a stored format. */
export const MODEL_PROVIDER = 'mechane';
