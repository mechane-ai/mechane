import { RecordText, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { IntegrationSecretReference, RemoteMcpUrl } from '../connections/schemas.ts';

const MAXIMUM_SERVICE_ID_LENGTH = 128;

/** The owner chooses one request collection; its credential stays outside the guest environment. */
export const RequestService = wireStruct({
  fields: {
    serviceId: Schema.NonEmptyString.check(Schema.isMaxLength(MAXIMUM_SERVICE_ID_LENGTH)),
    url: RemoteMcpUrl,
    secretReference: IntegrationSecretReference,
  },
});

export type RequestService = typeof RequestService.Type;

/** Existing grants remain readable independently of future request limits. */
export const RequestServiceRecord = wireStruct({
  fields: { serviceId: Schema.NonEmptyString, url: RemoteMcpUrl, secretReference: RecordText },
});
