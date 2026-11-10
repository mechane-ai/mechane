export type ControlChange = {
  readonly id: string;
  readonly workspaceId: string;
  readonly mechId: string;
  readonly kind: 'control.changed';
  readonly sourceSequence: number;
  readonly definitionRevision: number;
  readonly createdAt: string;
  readonly payloadDigest: string;
};

export type ClaimControlChanges = {
  readonly claimId: string;
  readonly maxRows: number;
  readonly leaseMilliseconds: number;
};

export type ControlChangeClaim = { readonly id: string; readonly claimId: string };
export type FailedControlChange = ControlChangeClaim & { readonly reason: 'recipient_unavailable' | 'delivery_failed' };
export type ControlChangeDeliveryIdentity = Pick<ControlChange, 'id' | 'payloadDigest'>;
export type ControlChangeDelivery = { readonly change: ControlChange; readonly isDelivered: boolean };

export type ControlChangeStore = {
  readonly claimControlChanges: (input: ClaimControlChanges) => Promise<ReadonlyArray<ControlChange>>;
  readonly failControlChange: (input: FailedControlChange) => Promise<boolean>;
  readonly readControlChangeDelivery: (input: ControlChangeDeliveryIdentity) => Promise<ControlChangeDelivery | null>;
  readonly acknowledgeControlChangeDelivery: (input: ControlChangeDeliveryIdentity) => Promise<boolean>;
};
