/** Intake notices remain deliverable while agent work is paused. */
export const SlackDeliveryPurpose = { Reply: 'reply', Notice: 'notice' } as const;

export type SlackDeliveryPurpose = (typeof SlackDeliveryPurpose)[keyof typeof SlackDeliveryPurpose];
