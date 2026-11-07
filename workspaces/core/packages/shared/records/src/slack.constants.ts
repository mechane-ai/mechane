/** The durable send state; uncertain outcomes require evidence before further action. */
export const SlackDeliveryStatus = {
  Pending: 'pending',
  Uncertain: 'uncertain',
  Sent: 'sent',
  Blocked: 'blocked',
} as const;

export type SlackDeliveryStatus = (typeof SlackDeliveryStatus)[keyof typeof SlackDeliveryStatus];
