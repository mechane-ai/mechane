import { Effect, Schema } from 'effect';
import { GATEWAY_CERTIFICATE } from './constants.ts';

/** Chromium sandboxing stays enabled unless the installation explicitly configures its disable switch. */
export const BrowserSandboxDisabledVariable = Schema.fromJsonString(Schema.Boolean).pipe(
  Schema.withDecodingDefaultKey(Effect.succeed('false')),
);

/** The launcher can select the gateway certificate, never an arbitrary trust file. */
export const BrowserCertificateVariable = Schema.OptionFromOptionalKey(Schema.Literal(GATEWAY_CERTIFICATE));
