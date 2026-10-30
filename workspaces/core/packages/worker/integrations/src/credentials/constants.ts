/** Credential envelopes use authenticated encryption supported by both Workers and the local runtime. */
export const CREDENTIAL_ALGORITHM = 'AES-GCM';
/** AES-GCM uses a fresh 96-bit nonce for every stored credential version. */
export const CREDENTIAL_NONCE_BYTES = 12;
