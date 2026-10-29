/** Mutations of an existing sandbox. */
export const TensorlakeAction = { Suspend: 'suspend', Resume: 'resume' } as const;

export type TensorlakeAction = (typeof TensorlakeAction)[keyof typeof TensorlakeAction];
